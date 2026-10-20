-- UstaPlan job notes (owner request N-1, IMPLEMENTATION_PLAN §15; DATA_MODEL §2 job_notes).
-- Several written notes per job: the artisan's private notes (plain RLS CRUD)
-- and the customer's notes (written by the server only, after the link check).
-- Replaces jobs.private_note: existing values are copied, the column is dropped
-- and create_job takes p_notes text[] instead of p_private_note.
-- Forward-only; contains no secrets or environment URLs.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid(),
  job_id uuid not null,
  author text not null default 'artisan' check (author in ('artisan', 'customer')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  foreign key (owner_user_id, job_id)
    references public.jobs (owner_user_id, id) on delete cascade,
  check (author <> 'customer' or length(body) <= 1000)
);

create index job_notes_job_idx on public.job_notes (job_id, author, created_at);

-- updated_at always; edited_at only when the text itself changes ("Düzenlendi").
create function public.job_notes_touch()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  if new.body is distinct from old.body then
    new.edited_at = pg_catalog.now();
  end if;
  return new;
end;
$$;

create trigger job_notes_touch before update on public.job_notes
  for each row execute function public.job_notes_touch();

-- ---------------------------------------------------------------------------
-- Grants and RLS: the artisan reads both authors and writes only their own
-- notes. Customer notes are written by the service role (customer routes).
-- ---------------------------------------------------------------------------
revoke all on table public.job_notes from anon, authenticated;
revoke execute on function public.job_notes_touch() from public, anon, authenticated;

grant select, insert, delete on public.job_notes to authenticated;
grant update (body) on public.job_notes to authenticated;

alter table public.job_notes enable row level security;

create policy job_notes_select_own on public.job_notes
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy job_notes_insert_own on public.job_notes
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and author = 'artisan' and edited_at is null);
create policy job_notes_update_own on public.job_notes
  for update to authenticated
  using (owner_user_id = (select auth.uid()) and author = 'artisan')
  with check (owner_user_id = (select auth.uid()) and author = 'artisan');
create policy job_notes_delete_own on public.job_notes
  for delete to authenticated using (owner_user_id = (select auth.uid()) and author = 'artisan');

-- ---------------------------------------------------------------------------
-- Move jobs.private_note into the notes list, then drop the column.
-- ---------------------------------------------------------------------------
insert into public.job_notes (owner_user_id, job_id, author, body, created_at, updated_at)
select owner_user_id, id, 'artisan', btrim(private_note), created_at, created_at
from public.jobs
where length(btrim(coalesce(private_note, ''))) > 0;

drop function public.create_job(uuid, text, uuid, text, text, uuid, text, numeric, numeric, boolean, timestamptz, timestamptz);

alter table public.jobs drop column private_note;

-- ---------------------------------------------------------------------------
-- create_job: as before (M2.1), with optional private notes (≤ 10, each
-- ≤ 4000 characters) inserted in the same transaction. A repeated p_job_id
-- still returns the existing job and adds nothing.
-- Returns {result: ok | customer_not_found | invalid_input, job_id?, customer_id?}.
-- ---------------------------------------------------------------------------
create function public.create_job(
  p_job_id uuid,
  p_title text,
  p_customer_id uuid default null,
  p_new_customer_name text default null,
  p_new_customer_phone text default null,
  p_address_id uuid default null,
  p_notes text[] default null,
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
  if coalesce(cardinality(p_notes), 0) > 10
     or exists (select 1 from unnest(p_notes) as n(body) where length(btrim(coalesce(n.body, ''))) > 4000) then
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
    id, owner_user_id, customer_id, address_id, title,
    estimated_price, agreed_price, show_price_to_customer, status
  )
  values (
    p_job_id, v_uid, v_customer_id, p_address_id, btrim(p_title),
    p_estimated_price, p_agreed_price, coalesce(p_show_price, false),
    case when p_starts_at is null then 'unplanned' else 'scheduled' end
  );

  -- Notes keep the order they were written in (one statement, increasing timestamps).
  insert into public.job_notes (owner_user_id, job_id, author, body, created_at, updated_at)
  select v_uid, p_job_id, 'artisan', btrim(n.body),
         now() + (n.ord * interval '1 microsecond'), now() + (n.ord * interval '1 microsecond')
  from unnest(p_notes) with ordinality as n(body, ord)
  where length(btrim(coalesce(n.body, ''))) > 0;

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

revoke execute on function public.create_job(uuid, text, uuid, text, text, uuid, text[], numeric, numeric, boolean, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_job(uuid, text, uuid, text, text, uuid, text[], numeric, numeric, boolean, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Customer note events (payload {note_id}, never the text) and the inbox
-- category for them (N.3).
-- ---------------------------------------------------------------------------
alter table public.job_events drop constraint job_events_event_type_check;
alter table public.job_events add constraint job_events_event_type_check check (event_type in (
  'job_created', 'job_updated', 'status_changed', 'price_changed', 'price_visibility_changed',
  'appointment_scheduled', 'appointment_rescheduled', 'appointment_completed', 'appointment_cancelled',
  'request_created', 'request_countered', 'request_accepted', 'request_rejected', 'request_withdrawn',
  'request_closed', 'job_cancelled', 'job_reopened', 'media_added', 'media_deleted',
  'share_disabled', 'share_enabled', 'share_rotated',
  'note_added', 'note_updated', 'note_deleted'
));

alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in (
  'customer_cancelled', 'reschedule_requested', 'counter_accepted', 'request_withdrawn',
  'customer_photo_added', 'appointment_reminder', 'daily_digest', 'customer_note'
));
