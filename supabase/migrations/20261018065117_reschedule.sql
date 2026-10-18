-- reschedule (M5.3): the customer/artisan date negotiation (spec §5.2,
-- plan §8). One open negotiation per appointment (partial unique index in
-- core). Lock order everywhere: job row first, then the request, then
-- appointment rows. Forward-only; contains no secrets or environment URLs.
--
-- Public RPCs (service_role only, called by the token-verified route
-- handlers): public_request_reschedule, public_withdraw_request,
-- public_accept_counter. Artisan RPC (authenticated): respond_to_request.
-- Results: ok · link_invalid (public) · not_found (artisan) ·
-- invalid_transition · invalid_input · expired · rate_limited.

-- ---------------------------------------------------------------------------
-- reschedule_swap (internal): the atomic swap (plan §8). The caller holds the
-- job lock and has checked the request is open and the old appointment is
-- still scheduled. New appointment scheduled, old one superseded, request
-- accepted, events written. Not executable by any API role.
-- ---------------------------------------------------------------------------
create function public.reschedule_swap(p_request_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_actor text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
  v_old record;
  v_new_id uuid;
begin
  select id, owner_user_id, job_id, appointment_id into v_req
  from public.appointment_requests where id = p_request_id for update;

  select id, starts_at, ends_at into v_old
  from public.appointments where id = v_req.appointment_id and status = 'scheduled' for update;
  if not found then
    raise exception 'appointment is not scheduled' using errcode = '23514';
  end if;

  insert into public.appointments (owner_user_id, job_id, starts_at, ends_at)
  values (v_req.owner_user_id, v_req.job_id, p_starts_at, p_ends_at)
  returning id into v_new_id;

  update public.appointments
  set status = 'superseded', replaced_by_id = v_new_id, closed_at = now()
  where id = v_old.id;

  update public.appointment_requests
  set status = 'accepted', resolved_at = now(), resulting_appointment_id = v_new_id
  where id = p_request_id;

  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values
    (v_req.owner_user_id, v_req.job_id, 'request_accepted', p_actor,
     jsonb_build_object('request_id', p_request_id, 'starts_at', p_starts_at, 'ends_at', p_ends_at)),
    (v_req.owner_user_id, v_req.job_id, 'appointment_rescheduled', p_actor, jsonb_build_object(
      'appointment_id', v_new_id, 'previous_appointment_id', v_old.id,
      'old_starts_at', v_old.starts_at, 'old_ends_at', v_old.ends_at,
      'starts_at', p_starts_at, 'ends_at', p_ends_at, 'request_id', p_request_id));

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- public_request_reschedule: the customer asks for a new start time for the
-- job's next appointment (the earliest scheduled one that hasn't ended).
-- Same duration; future times only (≤ 365 days ahead); ≤ 10 requests per job
-- per 24 h. An open negotiation on that appointment is withdrawn and replaced
-- in the same transaction (a new request or a reply to a counter). The same
-- pending request again returns ok without changes. Leaves the artisan a
-- reschedule_requested notification (inbox + pending push).
-- ---------------------------------------------------------------------------
create function public.public_request_reschedule(p_job_id uuid, p_share_version integer, p_starts_at timestamptz, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_appt record;
  v_open record;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ends_at timestamptz;
  v_request_id uuid;
begin
  if p_job_id is null or p_share_version is null or p_starts_at is null or length(coalesce(v_note, '')) > 500 then
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
  if v_job.status not in ('scheduled', 'in_progress', 'waiting_material') then
    return jsonb_build_object('result', 'invalid_transition');
  end if;

  select id, starts_at, ends_at into v_appt
  from public.appointments
  where job_id = p_job_id and owner_user_id = v_job.owner_user_id and status = 'scheduled' and ends_at > now()
  order by starts_at
  limit 1
  for update;
  if not found then
    return jsonb_build_object('result', 'invalid_transition');
  end if;

  if p_starts_at <= now() or p_starts_at > now() + interval '365 days' or p_starts_at = v_appt.starts_at then
    return jsonb_build_object('result', 'invalid_input');
  end if;
  v_ends_at := p_starts_at + (v_appt.ends_at - v_appt.starts_at);

  select id, status, requested_starts_at, request_note into v_open
  from public.appointment_requests
  where appointment_id = v_appt.id and status in ('pending_artisan', 'pending_customer')
  for update;

  -- Repeat of the same request (double tap, retry).
  if found and v_open.status = 'pending_artisan' and v_open.requested_starts_at = p_starts_at
     and v_open.request_note is not distinct from v_note then
    return jsonb_build_object('result', 'ok', 'request_id', v_open.id);
  end if;

  if (select count(*) from public.appointment_requests
      where job_id = p_job_id and created_at > now() - interval '24 hours') >= 10 then
    return jsonb_build_object('result', 'rate_limited');
  end if;

  if v_open.id is not null then
    update public.appointment_requests set status = 'withdrawn', resolved_at = now() where id = v_open.id;
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_job.owner_user_id, p_job_id, 'request_withdrawn', 'link_holder',
            jsonb_build_object('request_id', v_open.id, 'replaced', true));
  end if;

  insert into public.appointment_requests
    (owner_user_id, job_id, appointment_id, requested_starts_at, requested_ends_at, request_note)
  values (v_job.owner_user_id, p_job_id, v_appt.id, p_starts_at, v_ends_at, v_note)
  returning id into v_request_id;

  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values (v_job.owner_user_id, p_job_id, 'request_created', 'link_holder', jsonb_build_object(
    'request_id', v_request_id, 'appointment_id', v_appt.id,
    'old_starts_at', v_appt.starts_at, 'starts_at', p_starts_at, 'ends_at', v_ends_at));

  insert into public.notifications
    (owner_user_id, job_id, appointment_id, request_id, category, payload, dedupe_key, in_inbox, push_status, push_next_attempt_at)
  values (
    v_job.owner_user_id, p_job_id, v_appt.id, v_request_id, 'reschedule_requested',
    jsonb_build_object(
      'job_title', v_job.title,
      'customer_first_name', split_part(btrim(v_job.customer_name), ' ', 1),
      'old_starts_at', v_appt.starts_at,
      'starts_at', p_starts_at),
    'request:' || v_request_id::text, true, 'pending', now());

  return jsonb_build_object('result', 'ok', 'request_id', v_request_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- public_withdraw_request: the customer withdraws an open request of this
-- job. Already withdrawn → ok. Inbox-only notification for the artisan.
-- ---------------------------------------------------------------------------
create function public.public_withdraw_request(p_job_id uuid, p_share_version integer, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_req record;
begin
  if p_job_id is null or p_share_version is null or p_request_id is null then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  select j.id, j.owner_user_id, j.title, j.share_enabled, j.share_version, c.name as customer_name
  into v_job
  from public.jobs j
  join public.customers c on c.owner_user_id = j.owner_user_id and c.id = j.customer_id
  where j.id = p_job_id
  for update of j;
  if not found or not v_job.share_enabled or v_job.share_version <> p_share_version then
    return jsonb_build_object('result', 'link_invalid');
  end if;

  select id, status, appointment_id into v_req
  from public.appointment_requests where id = p_request_id and job_id = p_job_id for update;
  if not found then
    return jsonb_build_object('result', 'invalid_transition');
  end if;
  if v_req.status = 'withdrawn' then
    return jsonb_build_object('result', 'ok');
  end if;
  if v_req.status not in ('pending_artisan', 'pending_customer') then
    return jsonb_build_object('result', 'invalid_transition');
  end if;

  update public.appointment_requests set status = 'withdrawn', resolved_at = now() where id = p_request_id;
  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values (v_job.owner_user_id, p_job_id, 'request_withdrawn', 'link_holder', jsonb_build_object('request_id', p_request_id));

  insert into public.notifications
    (owner_user_id, job_id, appointment_id, request_id, category, payload, dedupe_key, in_inbox, push_status)
  values (
    v_job.owner_user_id, p_job_id, v_req.appointment_id, p_request_id, 'request_withdrawn',
    jsonb_build_object('job_title', v_job.title, 'customer_first_name', split_part(btrim(v_job.customer_name), ' ', 1)),
    'withdrawn:' || p_request_id::text, true, 'none')
  on conflict (owner_user_id, dedupe_key) do nothing;

  return jsonb_build_object('result', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- public_accept_counter: the customer accepts the artisan's counter-offer →
-- atomic swap. Repeat → ok with the same appointment. A counter whose time
-- has passed → expired (nothing changes; the customer can ask again).
-- Leaves the artisan a counter_accepted notification (inbox + pending push).
-- ---------------------------------------------------------------------------
create function public.public_accept_counter(p_job_id uuid, p_share_version integer, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job record;
  v_req record;
  v_new_id uuid;
begin
  if p_job_id is null or p_share_version is null or p_request_id is null then
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

  select id, status, appointment_id, counter_starts_at, counter_ends_at, resulting_appointment_id into v_req
  from public.appointment_requests where id = p_request_id and job_id = p_job_id for update;
  if not found then
    return jsonb_build_object('result', 'invalid_transition');
  end if;
  if v_req.status = 'accepted' then
    return jsonb_build_object('result', 'ok', 'appointment_id', v_req.resulting_appointment_id);
  end if;
  if v_req.status <> 'pending_customer' or v_job.status not in ('scheduled', 'in_progress', 'waiting_material') then
    return jsonb_build_object('result', 'invalid_transition');
  end if;
  if v_req.counter_starts_at <= now() then
    return jsonb_build_object('result', 'expired');
  end if;

  v_new_id := public.reschedule_swap(p_request_id, v_req.counter_starts_at, v_req.counter_ends_at, 'link_holder');

  insert into public.notifications
    (owner_user_id, job_id, appointment_id, request_id, category, payload, dedupe_key, in_inbox, push_status, push_next_attempt_at)
  values (
    v_job.owner_user_id, p_job_id, v_new_id, p_request_id, 'counter_accepted',
    jsonb_build_object(
      'job_title', v_job.title,
      'customer_first_name', split_part(btrim(v_job.customer_name), ' ', 1),
      'starts_at', v_req.counter_starts_at),
    'accepted:' || p_request_id::text, true, 'pending', now())
  on conflict (owner_user_id, dedupe_key) do nothing;

  return jsonb_build_object('result', 'ok', 'appointment_id', v_new_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- respond_to_request: the artisan answers a customer request.
--   approve → atomic swap to the requested time (pending_artisan only;
--             a time that has passed → expired)
--   reject  → rejected (pending_artisan only)
--   counter → pending_customer with the counter times (from pending_artisan,
--             or a new counter while pending_customer); future start, 15–480 min
-- Repeats of an action that already took effect return ok.
-- ---------------------------------------------------------------------------
create function public.respond_to_request(
  p_request_id uuid,
  p_action text,
  p_counter_starts_at timestamptz default null,
  p_counter_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job_id uuid;
  v_job record;
  v_req record;
  v_new_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_request_id is null or p_action is null or p_action not in ('approve', 'reject', 'counter') then
    return jsonb_build_object('result', 'invalid_input');
  end if;
  if p_action = 'counter' and (
       p_counter_starts_at is null or p_counter_ends_at is null
       or p_counter_ends_at - p_counter_starts_at not between interval '15 minutes' and interval '480 minutes'
       or p_counter_starts_at <= now()) then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  -- Job first (lock order), found through the caller's own request.
  select job_id into v_job_id from public.appointment_requests where id = p_request_id and owner_user_id = v_uid;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  select id, status into v_job from public.jobs where id = v_job_id and owner_user_id = v_uid for update;

  select id, status, requested_starts_at, requested_ends_at, counter_starts_at, counter_ends_at, resulting_appointment_id
  into v_req
  from public.appointment_requests where id = p_request_id for update;

  -- Idempotent repeats.
  if (p_action = 'approve' and v_req.status = 'accepted')
     or (p_action = 'reject' and v_req.status = 'rejected')
     or (p_action = 'counter' and v_req.status = 'pending_customer'
         and v_req.counter_starts_at = p_counter_starts_at and v_req.counter_ends_at = p_counter_ends_at) then
    return jsonb_build_object('result', 'ok', 'appointment_id', v_req.resulting_appointment_id);
  end if;

  if v_job.status not in ('scheduled', 'in_progress', 'waiting_material')
     or not (v_req.status = 'pending_artisan' or (p_action = 'counter' and v_req.status = 'pending_customer')) then
    return jsonb_build_object('result', 'invalid_transition');
  end if;

  if p_action = 'approve' then
    if v_req.requested_starts_at <= now() then
      return jsonb_build_object('result', 'expired');
    end if;
    v_new_id := public.reschedule_swap(p_request_id, v_req.requested_starts_at, v_req.requested_ends_at, 'artisan');
    return jsonb_build_object('result', 'ok', 'appointment_id', v_new_id);
  end if;

  if p_action = 'reject' then
    update public.appointment_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
    insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
    values (v_uid, v_job_id, 'request_rejected', 'artisan', jsonb_build_object('request_id', p_request_id));
    return jsonb_build_object('result', 'ok');
  end if;

  update public.appointment_requests
  set status = 'pending_customer', counter_starts_at = p_counter_starts_at, counter_ends_at = p_counter_ends_at
  where id = p_request_id;
  insert into public.job_events (owner_user_id, job_id, event_type, actor_type, payload)
  values (v_uid, v_job_id, 'request_countered', 'artisan', jsonb_build_object(
    'request_id', p_request_id, 'starts_at', p_counter_starts_at, 'ends_at', p_counter_ends_at));
  return jsonb_build_object('result', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: PUBLIC's default EXECUTE is removed explicitly (see core).
-- ---------------------------------------------------------------------------
revoke execute on function public.reschedule_swap(uuid, timestamptz, timestamptz, text) from public, anon, authenticated, service_role;
revoke execute on function public.public_request_reschedule(uuid, integer, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.public_withdraw_request(uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.public_accept_counter(uuid, integer, uuid) from public, anon, authenticated;
revoke execute on function public.respond_to_request(uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.public_request_reschedule(uuid, integer, timestamptz, text) to service_role;
grant execute on function public.public_withdraw_request(uuid, integer, uuid) to service_role;
grant execute on function public.public_accept_counter(uuid, integer, uuid) to service_role;
grant execute on function public.respond_to_request(uuid, text, timestamptz, timestamptz) to authenticated;
