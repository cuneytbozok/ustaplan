-- UstaPlan appointments workflow (M3.1). Implements DATA_MODEL §4
-- save_appointment and close_appointment. Rules J2/J3: IMPLEMENTATION_PLAN §7.
-- Lock order everywhere: job row first, then appointment rows.
-- Forward-only; contains no secrets or environment URLs.

-- ---------------------------------------------------------------------------
-- save_appointment: a new visit (p_appointment_id null) or a reschedule of a
-- scheduled one (old → superseded + replaced_by_id, its open request closed).
-- J2: an unplanned job becomes scheduled; other open statuses are kept.
-- Closed jobs take no appointments. Past times are allowed (record a visit late).
-- Idempotent: the same call again returns the appointment it already created
-- (same job and times; for a reschedule, the old one's replacement).
-- Returns {result: ok | not_found | invalid_transition | invalid_input, appointment_id?, status?}.
-- ---------------------------------------------------------------------------
create function public.save_appointment(
  p_job_id uuid,
  p_appointment_id uuid default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job record;
  v_old record;
  v_new_id uuid;
  v_status text;
  v_closed_requests int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_job_id is null or p_starts_at is null or p_ends_at is null
     or p_ends_at - p_starts_at not between interval '15 minutes' and interval '480 minutes' then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  select id, status into v_job from public.jobs where id = p_job_id and owner_user_id = v_uid for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  if p_appointment_id is null then
    -- Repeat of the same new visit.
    select id into v_new_id from public.appointments
    where job_id = p_job_id and owner_user_id = v_uid and status = 'scheduled'
      and starts_at = p_starts_at and ends_at = p_ends_at
    limit 1;
    if found then
      return jsonb_build_object('result', 'ok', 'appointment_id', v_new_id, 'status', v_job.status);
    end if;
  else
    select a.id, a.status, a.starts_at, a.ends_at, a.replaced_by_id, r.starts_at as r_starts, r.ends_at as r_ends
    into v_old
    from public.appointments a
    left join public.appointments r on r.id = a.replaced_by_id
    where a.id = p_appointment_id and a.job_id = p_job_id and a.owner_user_id = v_uid
    for update of a;
    if not found then
      return jsonb_build_object('result', 'not_found');
    end if;
    -- Repeat of the same reschedule.
    if v_old.status = 'superseded' and v_old.r_starts = p_starts_at and v_old.r_ends = p_ends_at then
      return jsonb_build_object('result', 'ok', 'appointment_id', v_old.replaced_by_id, 'status', v_job.status);
    end if;
    if v_old.status <> 'scheduled' then
      return jsonb_build_object('result', 'invalid_transition', 'status', v_job.status);
    end if;
  end if;

  if v_job.status in ('completed', 'cancelled') then
    return jsonb_build_object('result', 'invalid_transition', 'status', v_job.status);
  end if;

  insert into public.appointments (owner_user_id, job_id, starts_at, ends_at)
  values (v_uid, p_job_id, p_starts_at, p_ends_at)
  returning id into v_new_id;

  if p_appointment_id is null then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'appointment_scheduled', 'artisan',
            jsonb_build_object('appointment_id', v_new_id, 'starts_at', p_starts_at, 'ends_at', p_ends_at));
  else
    update public.appointments
    set status = 'superseded', replaced_by_id = v_new_id, closed_at = now()
    where id = p_appointment_id;

    -- The artisan changed the visit: its open negotiation is closed (system).
    with closed as (
      update public.appointment_requests
      set status = 'closed', resolved_at = now()
      where appointment_id = p_appointment_id and owner_user_id = v_uid and status in ('pending_artisan', 'pending_customer')
      returning id
    )
    select count(*) into v_closed_requests from closed;

    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'appointment_rescheduled', 'artisan', jsonb_build_object(
      'appointment_id', v_new_id, 'previous_appointment_id', p_appointment_id,
      'old_starts_at', v_old.starts_at, 'old_ends_at', v_old.ends_at,
      'starts_at', p_starts_at, 'ends_at', p_ends_at, 'closed_requests', v_closed_requests));
  end if;

  -- J2
  v_status := v_job.status;
  if v_job.status = 'unplanned' then
    v_status := 'scheduled';
    update public.jobs set status = 'scheduled' where id = p_job_id;
  end if;

  return jsonb_build_object('result', 'ok', 'appointment_id', v_new_id, 'status', v_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- close_appointment: the artisan marks a scheduled visit completed or cancelled.
-- Its open negotiation is closed. J3, when no scheduled visit is left:
-- a scheduled job becomes unplanned (cancelled) or in_progress (completed).
-- Completing a visit never completes the job. Repeating the same outcome is ok.
-- Returns {result: ok | not_found | invalid_transition | invalid_input, status?}.
-- ---------------------------------------------------------------------------
create function public.close_appointment(p_appointment_id uuid, p_outcome text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job_id uuid;
  v_job record;
  v_appt record;
  v_status text;
  v_closed_requests int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_appointment_id is null or p_outcome is null or p_outcome not in ('completed', 'cancelled') then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  select job_id into v_job_id from public.appointments where id = p_appointment_id and owner_user_id = v_uid;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  select id, status into v_job from public.jobs where id = v_job_id and owner_user_id = v_uid for update;
  select id, status, starts_at, ends_at into v_appt from public.appointments where id = p_appointment_id for update;

  if v_appt.status = p_outcome then
    return jsonb_build_object('result', 'ok', 'status', v_job.status);
  end if;
  if v_appt.status <> 'scheduled' then
    return jsonb_build_object('result', 'invalid_transition', 'status', v_job.status);
  end if;

  update public.appointments set status = p_outcome, closed_at = now() where id = p_appointment_id;

  with closed as (
    update public.appointment_requests
    set status = 'closed', resolved_at = now()
    where appointment_id = p_appointment_id and owner_user_id = v_uid and status in ('pending_artisan', 'pending_customer')
    returning id
  )
  select count(*) into v_closed_requests from closed;

  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values (v_uid, v_job_id, case p_outcome when 'completed' then 'appointment_completed' else 'appointment_cancelled' end, 'artisan',
          jsonb_build_object('appointment_id', p_appointment_id, 'starts_at', v_appt.starts_at, 'ends_at', v_appt.ends_at,
                             'closed_requests', v_closed_requests));

  -- J3
  v_status := v_job.status;
  if v_job.status = 'scheduled' and not exists (
    select 1 from public.appointments where job_id = v_job_id and owner_user_id = v_uid and status = 'scheduled'
  ) then
    v_status := case p_outcome when 'completed' then 'in_progress' else 'unplanned' end;
    update public.jobs set status = v_status where id = v_job_id;
  end if;

  return jsonb_build_object('result', 'ok', 'status', v_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: PUBLIC's default EXECUTE is removed explicitly (see core).
-- ---------------------------------------------------------------------------
revoke execute on function public.save_appointment(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.close_appointment(uuid, text) from public, anon;
grant execute on function public.save_appointment(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.close_appointment(uuid, text) to authenticated;
