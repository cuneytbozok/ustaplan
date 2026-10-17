-- UstaPlan jobs workflow (M2.1). Implements DATA_MODEL §4 create_job and
-- change_job_status, and §5 jobs_log_changes. Rules J1-J6: IMPLEMENTATION_PLAN §7.
-- Forward-only; contains no secrets or environment URLs.

-- ---------------------------------------------------------------------------
-- create_job: optional inline customer + job + optional first appointment,
-- in one transaction. p_job_id comes from the caller, so a repeated call
-- returns the same job instead of creating a duplicate.
-- Returns {result: ok | customer_not_found | invalid_input, job_id?, customer_id?}.
-- ---------------------------------------------------------------------------
create function public.create_job(
  p_job_id uuid,
  p_title text,
  p_customer_id uuid default null,
  p_new_customer_name text default null,
  p_new_customer_phone text default null,
  p_address_id uuid default null,
  p_private_note text default null,
  p_estimated_price numeric default null,
  p_agreed_price numeric default null,
  p_show_price boolean default false,
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
  v_customer_id uuid;
  v_existing record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_job_id is null then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  -- Idempotency: the same id again returns the job that already exists.
  select id, owner_user_id, customer_id into v_existing from public.jobs where id = p_job_id;
  if found then
    if v_existing.owner_user_id <> v_uid then
      return jsonb_build_object('result', 'invalid_input');
    end if;
    return jsonb_build_object('result', 'ok', 'job_id', v_existing.id, 'customer_id', v_existing.customer_id);
  end if;

  -- Exactly one of: existing customer, or a new one by name.
  if (p_customer_id is null) = (nullif(btrim(coalesce(p_new_customer_name, '')), '') is null) then
    return jsonb_build_object('result', 'invalid_input');
  end if;
  if (p_starts_at is null) <> (p_ends_at is null) then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  if p_customer_id is not null then
    select id into v_customer_id from public.customers where id = p_customer_id and owner_user_id = v_uid;
    if not found then
      return jsonb_build_object('result', 'customer_not_found');
    end if;
  else
    insert into public.customers (owner_user_id, name, phone)
    values (v_uid, btrim(p_new_customer_name), nullif(btrim(coalesce(p_new_customer_phone, '')), ''))
    returning id into v_customer_id;
  end if;

  -- The composite FK (owner, customer, address) rejects a foreign or mismatched address.
  insert into public.jobs (
    id, owner_user_id, customer_id, address_id, title, private_note,
    estimated_price, agreed_price, show_price_to_customer, status
  )
  values (
    p_job_id, v_uid, v_customer_id, p_address_id, btrim(p_title), nullif(btrim(coalesce(p_private_note, '')), ''),
    p_estimated_price, p_agreed_price, coalesce(p_show_price, false),
    case when p_starts_at is null then 'unplanned' else 'scheduled' end
  );

  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values (v_uid, p_job_id, 'job_created', 'artisan', '{}'::jsonb);

  if p_starts_at is not null then
    insert into public.appointments (owner_user_id, job_id, starts_at, ends_at)
    values (v_uid, p_job_id, p_starts_at, p_ends_at);
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'appointment_scheduled', 'artisan',
            jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at));
  end if;

  return jsonb_build_object('result', 'ok', 'job_id', p_job_id, 'customer_id', v_customer_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- change_job_status: the artisan's manual transitions (J1, J4, J5, J6).
--   start         → in_progress       (from unplanned, scheduled, waiting_material)
--   wait_material → waiting_material  (from unplanned, scheduled, in_progress)
--   complete      → completed  (from open; cancels not-yet-ended scheduled
--                               appointments and closes open requests)
--   cancel        → cancelled  (from open; same cascade; optional note)
--   reopen        → unplanned  (from completed or cancelled; link works again)
-- Repeating an action that already took effect returns ok without changes.
-- Returns {result: ok | not_found | invalid_transition | invalid_input, status?}.
-- ---------------------------------------------------------------------------
create function public.change_job_status(p_job_id uuid, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job record;
  v_target text;
  v_open constant text[] := array['unplanned', 'scheduled', 'in_progress', 'waiting_material'];
  v_cancelled_appointments int := 0;
  v_closed_requests int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  v_target := case p_action
    when 'start' then 'in_progress'
    when 'wait_material' then 'waiting_material'
    when 'complete' then 'completed'
    when 'cancel' then 'cancelled'
    when 'reopen' then 'unplanned'
  end;
  if v_target is null or length(coalesce(p_note, '')) > 500 then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  select id, status into v_job from public.jobs where id = p_job_id and owner_user_id = v_uid for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  -- Idempotent repeats.
  if v_job.status = v_target or (p_action = 'reopen' and v_job.status = any (v_open)) then
    return jsonb_build_object('result', 'ok', 'status', v_job.status);
  end if;

  if p_action = 'reopen' then
    if v_job.status not in ('completed', 'cancelled') then
      return jsonb_build_object('result', 'invalid_transition', 'status', v_job.status);
    end if;
    update public.jobs
    set status = 'unplanned', completed_at = null,
        cancelled_at = null, cancelled_by = null, cancelled_reason = null, cancelled_note = null
    where id = p_job_id;
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'job_reopened', 'artisan', jsonb_build_object('from', v_job.status));
    return jsonb_build_object('result', 'ok', 'status', 'unplanned');
  end if;

  -- Every other action starts from an open job.
  if not (v_job.status = any (v_open)) then
    return jsonb_build_object('result', 'invalid_transition', 'status', v_job.status);
  end if;

  if p_action in ('start', 'wait_material') then
    update public.jobs set status = v_target where id = p_job_id;
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'status_changed', 'artisan', jsonb_build_object('from', v_job.status, 'to', v_target));
    return jsonb_build_object('result', 'ok', 'status', v_target);
  end if;

  -- complete / cancel: appointments that haven't ended are cancelled (P-2, P-4),
  -- open negotiations are closed (system).
  with cancelled as (
    update public.appointments
    set status = 'cancelled', closed_at = now()
    where job_id = p_job_id and owner_user_id = v_uid and status = 'scheduled' and ends_at > now()
    returning id
  )
  select count(*) into v_cancelled_appointments from cancelled;

  with closed as (
    update public.appointment_requests
    set status = 'closed', resolved_at = now()
    where job_id = p_job_id and owner_user_id = v_uid and status in ('pending_artisan', 'pending_customer')
    returning id
  )
  select count(*) into v_closed_requests from closed;

  if p_action = 'complete' then
    update public.jobs set status = 'completed', completed_at = now() where id = p_job_id;
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'status_changed', 'artisan', jsonb_build_object(
      'from', v_job.status, 'to', 'completed',
      'cancelled_appointments', v_cancelled_appointments, 'closed_requests', v_closed_requests));
  else
    update public.jobs
    set status = 'cancelled', cancelled_at = now(), cancelled_by = 'artisan',
        cancelled_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_job_id;
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, p_job_id, 'job_cancelled', 'artisan', jsonb_build_object(
      'from', v_job.status, 'by', 'artisan',
      'cancelled_appointments', v_cancelled_appointments, 'closed_requests', v_closed_requests));
  end if;

  return jsonb_build_object('result', 'ok', 'status', v_target);
end;
$$;

-- ---------------------------------------------------------------------------
-- jobs_log_changes: history for edits made with plain column updates
-- (DATA_MODEL §5). Captures every write path. Payloads never contain phone
-- numbers or addresses. Also refuses a lower share_version, which would
-- revive links the artisan already rotated away.
-- ---------------------------------------------------------------------------
create function public.jobs_log_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := case when auth.uid() = new.owner_user_id then 'artisan' else 'system' end;
begin
  if new.share_version < old.share_version then
    raise exception 'share_version can only increase' using errcode = '23514';
  end if;

  if new.estimated_price is distinct from old.estimated_price then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'price_changed', v_actor,
            jsonb_build_object('field', 'estimated_price', 'old', old.estimated_price, 'new', new.estimated_price));
  end if;
  if new.agreed_price is distinct from old.agreed_price then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'price_changed', v_actor,
            jsonb_build_object('field', 'agreed_price', 'old', old.agreed_price, 'new', new.agreed_price));
  end if;
  if new.show_price_to_customer is distinct from old.show_price_to_customer then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'price_visibility_changed', v_actor,
            jsonb_build_object('old', old.show_price_to_customer, 'new', new.show_price_to_customer));
  end if;
  if new.share_enabled is distinct from old.share_enabled then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, case when new.share_enabled then 'share_enabled' else 'share_disabled' end, v_actor, '{}'::jsonb);
  end if;
  if new.share_version > old.share_version then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'share_rotated', v_actor, jsonb_build_object('version', new.share_version));
  end if;
  if new.title is distinct from old.title then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'job_updated', v_actor, jsonb_build_object('field', 'title', 'old', old.title, 'new', new.title));
  end if;
  if new.address_id is distinct from old.address_id then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'job_updated', v_actor, jsonb_build_object('field', 'address'));
  end if;
  if new.customer_id is distinct from old.customer_id then
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (new.owner_user_id, new.id, 'job_updated', v_actor, jsonb_build_object('field', 'customer'));
  end if;
  return null;
end;
$$;

create trigger jobs_log_changes after update on public.jobs
  for each row execute function public.jobs_log_changes();

-- ---------------------------------------------------------------------------
-- Privileges: PUBLIC's default EXECUTE is removed explicitly (see core).
-- ---------------------------------------------------------------------------
revoke execute on function public.create_job(uuid, text, uuid, text, text, uuid, text, numeric, numeric, boolean, timestamptz, timestamptz) from public, anon;
revoke execute on function public.change_job_status(uuid, text, text) from public, anon;
revoke execute on function public.jobs_log_changes() from public, anon, authenticated;
grant execute on function public.create_job(uuid, text, uuid, text, text, uuid, text, numeric, numeric, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.change_job_status(uuid, text, text) to authenticated;
