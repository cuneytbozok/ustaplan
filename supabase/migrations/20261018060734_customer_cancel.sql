-- customer_cancel (M5.1): the customer cancels a job through the signed link
-- (spec §5.3, plan §7 J6). Called only by the token-verified route handler
-- with the admin client; execute is granted to service_role only.

-- ---------------------------------------------------------------------------
-- public_cancel_job: locks the job, re-checks share_enabled and share_version
-- (a link rotated or closed between the token check and this call is refused),
-- then applies the J6 cascade, writes a link_holder event and leaves the
-- artisan a customer_cancelled notification (inbox + pending push), all in
-- one transaction.
--   reason: one of the jobs.cancelled_reason codes, required.
--   note:   ≤ 500 characters; required when reason = 'other'.
-- An already cancelled job returns ok without changes (repeat taps, two tabs).
-- If the artisan reopened the job and the customer cancels again, the same
-- notification row (dedupe key cancel:<job_id>) is re-armed: unread, new
-- payload, push pending again.
-- Returns {result: ok | link_invalid | invalid_transition | invalid_input, status?}.
-- ---------------------------------------------------------------------------
create function public.public_cancel_job(p_job_id uuid, p_share_version integer, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_open constant text[] := array['unplanned', 'scheduled', 'in_progress', 'waiting_material'];
  v_cancelled_appointments int := 0;
  v_closed_requests int := 0;
begin
  if p_job_id is null or p_share_version is null
     or p_reason is null
     or p_reason not in ('no_longer_needed', 'price_too_high', 'changed_mind', 'other_artisan', 'date_unsuitable', 'other')
     or length(coalesce(v_note, '')) > 500
     or (p_reason = 'other' and v_note is null) then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  select j.id, j.owner_user_id, j.status, j.title, j.share_enabled, j.share_version, c.name as customer_name
  into v_job
  from public.jobs j
  join public.customers c on c.owner_user_id = j.owner_user_id and c.id = j.customer_id
  where j.id = p_job_id
  for update of j;
  if not found or not v_job.share_enabled or v_job.share_version <> p_share_version then
    return jsonb_build_object('result', 'link_invalid');
  end if;

  if v_job.status = 'cancelled' then
    return jsonb_build_object('result', 'ok', 'status', 'cancelled');
  end if;
  if not (v_job.status = any (v_open)) then
    return jsonb_build_object('result', 'invalid_transition', 'status', v_job.status);
  end if;

  -- J6 cascade, same as change_job_status: visits that haven't ended are
  -- cancelled (P-2), open negotiations are closed.
  with cancelled as (
    update public.appointments
    set status = 'cancelled', closed_at = now()
    where job_id = p_job_id and owner_user_id = v_job.owner_user_id and status = 'scheduled' and ends_at > now()
    returning id
  )
  select count(*) into v_cancelled_appointments from cancelled;

  with closed as (
    update public.appointment_requests
    set status = 'closed', resolved_at = now()
    where job_id = p_job_id and owner_user_id = v_job.owner_user_id and status in ('pending_artisan', 'pending_customer')
    returning id
  )
  select count(*) into v_closed_requests from closed;

  update public.jobs
  set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer',
      cancelled_reason = p_reason, cancelled_note = v_note
  where id = p_job_id;

  -- The note stays on the job row only; events and notifications carry codes.
  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values (v_job.owner_user_id, p_job_id, 'job_cancelled', 'link_holder', jsonb_build_object(
    'from', v_job.status, 'by', 'customer', 'reason', p_reason,
    'cancelled_appointments', v_cancelled_appointments, 'closed_requests', v_closed_requests));

  insert into public.notifications
    (owner_user_id, job_id, category, payload, dedupe_key, in_inbox, push_status, push_next_attempt_at)
  values (
    v_job.owner_user_id, p_job_id, 'customer_cancelled',
    jsonb_build_object(
      'job_title', v_job.title,
      'customer_first_name', split_part(btrim(v_job.customer_name), ' ', 1),
      'reason', p_reason),
    'cancel:' || p_job_id::text, true, 'pending', now())
  on conflict (owner_user_id, dedupe_key) do update
  set payload = excluded.payload, read_at = null, created_at = now(),
      push_status = 'pending', push_attempts = 0, push_next_attempt_at = now(), pushed_at = null;

  return jsonb_build_object('result', 'ok', 'status', 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: public RPCs are for the server only (DATA_MODEL §4).
-- ---------------------------------------------------------------------------
revoke execute on function public.public_cancel_job(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.public_cancel_job(uuid, integer, text, text) to service_role;
