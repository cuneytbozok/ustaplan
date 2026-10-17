-- UstaPlan core schema (M1.1). Implements docs/architecture/DATA_MODEL.md
-- §2 tables, §3 grants and RLS, §5 touch_updated_at and §6 storage.
-- RPCs and the jobs_log_changes trigger come in later migrations.
-- Forward-only; contains no secrets or environment URLs.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Turkish-insensitive folding for search keys. The app folds queries the same way.
create function public.fold_tr(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.lower(pg_catalog.translate(input, 'İIıÇçĞğÖöŞşÜü', 'iiiccggoossuu'))
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  business_name text check (length(business_name) <= 120),
  contact_phone text check (contact_phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  private_note text check (length(private_note) <= 2000),
  search_key text generated always as (public.fold_tr(name) || ' ' || coalesce(phone, '')) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid(),
  customer_id uuid not null,
  label text check (length(label) <= 40),
  address_text text not null check (length(btrim(address_text)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, customer_id)
    references public.customers (owner_user_id, id) on delete cascade,
  unique (owner_user_id, customer_id, id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  customer_id uuid not null,
  address_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  search_key text generated always as (public.fold_tr(title)) stored,
  status text not null default 'unplanned'
    check (status in ('unplanned', 'scheduled', 'in_progress', 'waiting_material', 'completed', 'cancelled')),
  private_note text check (length(private_note) <= 4000),
  estimated_price numeric(12, 2) check (estimated_price >= 0),
  agreed_price numeric(12, 2) check (agreed_price >= 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  show_price_to_customer boolean not null default false,
  share_enabled boolean not null default true,
  share_version integer not null default 1 check (share_version > 0),
  cancelled_reason text
    check (cancelled_reason in ('no_longer_needed', 'price_too_high', 'changed_mind', 'other_artisan', 'date_unsuitable', 'other')),
  cancelled_note text check (length(cancelled_note) <= 500),
  cancelled_by text check (cancelled_by in ('customer', 'artisan')),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id),
  foreign key (owner_user_id, customer_id)
    references public.customers (owner_user_id, id) on delete restrict,
  foreign key (owner_user_id, customer_id, address_id)
    references public.customer_addresses (owner_user_id, customer_id, id) on delete set null (address_id),
  -- The estimate is never public; only an agreed price can be shown.
  check (not show_price_to_customer or agreed_price is not null),
  check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null)),
  check ((status = 'completed') = (completed_at is not null)),
  check (cancelled_by <> 'customer' or cancelled_reason is not null),
  check (cancelled_reason <> 'other' or cancelled_by <> 'customer' or length(btrim(cancelled_note)) > 0)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'superseded')),
  replaced_by_id uuid,
  closed_at timestamptz,
  private_note text check (length(private_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs (owner_user_id, id) on delete cascade,
  unique (owner_user_id, job_id, id),
  foreign key (owner_user_id, job_id, replaced_by_id)
    references public.appointments (owner_user_id, job_id, id),
  check (ends_at - starts_at between interval '15 minutes' and interval '480 minutes'),
  check (replaced_by_id is null or status = 'superseded'),
  check ((status = 'scheduled') = (closed_at is null))
);

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  appointment_id uuid not null,
  requested_starts_at timestamptz not null,
  requested_ends_at timestamptz not null,
  counter_starts_at timestamptz,
  counter_ends_at timestamptz,
  request_note text check (length(request_note) <= 500),
  status text not null default 'pending_artisan'
    check (status in ('pending_artisan', 'pending_customer', 'accepted', 'rejected', 'withdrawn', 'closed')),
  resolved_at timestamptz,
  resulting_appointment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id, appointment_id)
    references public.appointments (owner_user_id, job_id, id) on delete cascade,
  foreign key (owner_user_id, job_id, resulting_appointment_id)
    references public.appointments (owner_user_id, job_id, id),
  check (requested_ends_at > requested_starts_at),
  check (
    (counter_starts_at is null and counter_ends_at is null)
    or (counter_starts_at is not null and counter_ends_at is not null and counter_ends_at > counter_starts_at)
  ),
  check ((status in ('pending_artisan', 'pending_customer')) = (resolved_at is null)),
  check ((status = 'accepted') = (resulting_appointment_id is not null))
);

create table public.job_media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid(),
  job_id uuid not null,
  kind text not null check (kind in ('image', 'audio')),
  origin text not null check (origin in ('artisan', 'customer')),
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  storage_bucket text not null check (storage_bucket in ('job-images', 'job-audio')),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null,
  duration_seconds integer,
  deleted_at timestamptz,
  deleted_by text check (deleted_by in ('artisan', 'link_holder')),
  created_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs (owner_user_id, id) on delete cascade,
  check (storage_path like owner_user_id::text || '/' || job_id::text || '/%'),
  check (
    size_bytes > 0
    and ((kind = 'image' and size_bytes <= 2097152) or (kind = 'audio' and size_bytes <= 4194304))
  ),
  check (duration_seconds is null or (kind = 'audio' and duration_seconds between 1 and 60)),
  check ((deleted_at is null) = (deleted_by is null)),
  -- Audio is always artisan + private; customer images are always shared.
  check (
    (kind = 'audio' and origin = 'artisan' and visibility = 'private' and storage_bucket = 'job-audio')
    or (kind = 'image' and storage_bucket = 'job-images'
        and (origin = 'artisan' or (origin = 'customer' and visibility = 'shared')))
  )
);

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  event_type text not null check (event_type in (
    'job_created', 'job_updated', 'status_changed', 'price_changed', 'price_visibility_changed',
    'appointment_scheduled', 'appointment_rescheduled', 'appointment_completed', 'appointment_cancelled',
    'request_created', 'request_countered', 'request_accepted', 'request_rejected', 'request_withdrawn',
    'request_closed', 'job_cancelled', 'job_reopened', 'media_added', 'media_deleted',
    'share_disabled', 'share_enabled', 'share_rotated'
  )),
  actor_type text not null check (actor_type in ('artisan', 'link_holder', 'system')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs (owner_user_id, id) on delete cascade
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid,
  appointment_id uuid,
  request_id uuid,
  category text not null check (category in (
    'customer_cancelled', 'reschedule_requested', 'counter_accepted', 'request_withdrawn',
    'customer_photo_added', 'appointment_reminder', 'daily_digest'
  )),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  in_inbox boolean not null default true,
  read_at timestamptz,
  push_status text not null default 'none'
    check (push_status in ('none', 'pending', 'sending', 'sent', 'failed', 'skipped')),
  push_attempts smallint not null default 0 check (push_attempts >= 0),
  push_next_attempt_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs (owner_user_id, id) on delete cascade,
  unique (owner_user_id, dedupe_key)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  device_label text check (length(device_label) <= 60),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count smallint not null default 0 check (failure_count >= 0),
  unique (owner_user_id, endpoint)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index customers_owner_name_idx on public.customers (owner_user_id, name);
create index customer_addresses_owner_customer_idx on public.customer_addresses (owner_user_id, customer_id);
create index jobs_owner_status_updated_idx on public.jobs (owner_user_id, status, updated_at desc);
create index jobs_owner_customer_idx on public.jobs (owner_user_id, customer_id, created_at desc);
create index appointments_owner_scheduled_idx on public.appointments (owner_user_id, starts_at, ends_at)
  where status = 'scheduled';
create index appointments_owner_job_idx on public.appointments (owner_user_id, job_id, starts_at);
create index appointment_requests_owner_job_idx on public.appointment_requests (owner_user_id, job_id, created_at desc);
create unique index appointment_requests_one_open_idx on public.appointment_requests (appointment_id)
  where status in ('pending_artisan', 'pending_customer');
create index job_media_owner_job_idx on public.job_media (owner_user_id, job_id, created_at desc)
  where deleted_at is null;
create index job_events_owner_job_idx on public.job_events (owner_user_id, job_id, created_at desc);
create index notifications_inbox_idx on public.notifications (owner_user_id, created_at desc)
  where in_inbox;
create index notifications_push_queue_idx on public.notifications (push_next_attempt_at)
  where push_status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger touch_profiles_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_customers_updated_at before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger touch_customer_addresses_updated_at before update on public.customer_addresses
  for each row execute function public.touch_updated_at();
create trigger touch_jobs_updated_at before update on public.jobs
  for each row execute function public.touch_updated_at();
create trigger touch_appointments_updated_at before update on public.appointments
  for each row execute function public.touch_updated_at();
create trigger touch_appointment_requests_updated_at before update on public.appointment_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: anon gets nothing; authenticated gets exactly DATA_MODEL §3.
-- service_role keeps Supabase's default grants (admin client, server only).
-- ---------------------------------------------------------------------------

-- Objects created later in this schema by migrations get nothing for anon by default.
-- PUBLIC's built-in EXECUTE on functions can't be removed per schema, so every
-- later function must still `revoke execute ... from public, anon` explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

revoke all on table
  public.profiles, public.customers, public.customer_addresses, public.jobs, public.appointments,
  public.appointment_requests, public.job_media, public.job_events, public.notifications,
  public.push_subscriptions
from anon, authenticated;

revoke execute on function public.fold_tr(text) from public, anon;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.fold_tr(text) to authenticated, service_role;

grant select on public.profiles to authenticated;
grant update (display_name, business_name, contact_phone) on public.profiles to authenticated;

grant select, insert, delete on public.customers to authenticated;
grant update (name, phone, private_note) on public.customers to authenticated;

grant select, insert, delete on public.customer_addresses to authenticated;
grant update (label, address_text) on public.customer_addresses to authenticated;

-- Insert goes through create_job (M2.1). Status, cancel and completion columns
-- are not updatable directly: change_job_status (M2.1) owns them. No delete.
grant select on public.jobs to authenticated;
grant update (
  customer_id, address_id, title, private_note, estimated_price, agreed_price,
  show_price_to_customer, share_enabled, share_version
) on public.jobs to authenticated;

grant select on public.appointments to authenticated;
grant select on public.appointment_requests to authenticated;

grant select, insert on public.job_media to authenticated;
grant update (visibility, deleted_at, deleted_by) on public.job_media to authenticated;

grant select on public.job_events to authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select, insert, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: every policy is owner-scoped.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.jobs enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.job_media enable row level security;
alter table public.job_events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy customers_select_own on public.customers
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy customers_insert_own on public.customers
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy customers_update_own on public.customers
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy customers_delete_own on public.customers
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy customer_addresses_select_own on public.customer_addresses
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy customer_addresses_insert_own on public.customer_addresses
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy customer_addresses_update_own on public.customer_addresses
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy customer_addresses_delete_own on public.customer_addresses
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy jobs_select_own on public.jobs
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy jobs_update_own on public.jobs
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy appointments_select_own on public.appointments
  for select to authenticated using (owner_user_id = (select auth.uid()));

create policy appointment_requests_select_own on public.appointment_requests
  for select to authenticated using (owner_user_id = (select auth.uid()));

create policy job_media_select_own on public.job_media
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy job_media_insert_own on public.job_media
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()) and origin = 'artisan' and deleted_at is null);
create policy job_media_update_own on public.job_media
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy job_events_select_own on public.job_events
  for select to authenticated using (owner_user_id = (select auth.uid()));

create policy notifications_select_own on public.notifications
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));

create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (owner_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage (DATA_MODEL §6): private buckets, path <owner_id>/<job_id>/<media_id>.<ext>.
-- Folder 1 must be the caller and folder 2 one of the caller's jobs. No update
-- policy, so objects can't be overwritten. anon gets nothing; customer media
-- goes through the server only.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-images', 'job-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('job-audio', 'job-audio', false, 4194304, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/x-m4a']);

create policy job_media_objects_select_own on storage.objects
  for select to authenticated using (
    bucket_id in ('job-images', 'job-audio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.jobs j
      where j.owner_user_id = (select auth.uid()) and j.id::text = (storage.foldername(name))[2]
    )
  );

create policy job_media_objects_insert_own on storage.objects
  for insert to authenticated with check (
    bucket_id in ('job-images', 'job-audio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.jobs j
      where j.owner_user_id = (select auth.uid()) and j.id::text = (storage.foldername(name))[2]
    )
  );

create policy job_media_objects_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id in ('job-images', 'job-audio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.jobs j
      where j.owner_user_id = (select auth.uid()) and j.id::text = (storage.foldername(name))[2]
    )
  );
