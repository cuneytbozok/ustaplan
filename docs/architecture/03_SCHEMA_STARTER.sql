-- UstaPlan — PostgreSQL / Supabase *starting* schema (MVP v1.3)
-- SUPERSEDED: the reconciled target schema is docs/architecture/DATA_MODEL.md.
-- Kept for reference only. Never execute this file.
-- REVIEW AND TEST as a Supabase migration before deployment.
-- Auth users are created separately by a trusted admin script; that script
-- also inserts a matching profiles record, as no auth.users trigger is used.
-- Guest actions MUST go through validated Next.js server endpoints.
-- Operational state transitions (accept/cancel/counter) MUST use atomic
-- transactions / locked RPCs implemented by the coding agent.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  business_name text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  phone text,
  private_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  customer_id uuid not null,
  label text,
  address_text text not null check (length(btrim(address_text)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, customer_id)
    references public.customers(owner_user_id, id) on delete cascade,
  unique (owner_user_id, customer_id, id)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null,
  address_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text,
  status text not null default 'unplanned'
    check (status in ('unplanned','scheduled','in_progress','waiting_material','completed','cancelled')),
  private_note text,
  estimated_price numeric(12,2) check (estimated_price >= 0),
  agreed_price numeric(12,2) check (agreed_price >= 0),
  currency text not null default 'TRY' check (currency = 'TRY'),
  show_price_to_customer boolean not null default false,
  share_enabled boolean not null default true,
  share_version integer not null default 1 check (share_version > 0),
  cancelled_reason text,
  cancelled_note text,
  cancelled_by text check (cancelled_by in ('customer','artisan')),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, customer_id)
    references public.customers(owner_user_id, id),
  foreign key (owner_user_id, customer_id, address_id)
    references public.customer_addresses(owner_user_id, customer_id, id),
  unique (owner_user_id, id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled','superseded')),
  private_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (owner_user_id, job_id)
    references public.jobs(owner_user_id, id) on delete cascade,
  unique (owner_user_id, job_id, id)
);

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  appointment_id uuid not null,
  requested_starts_at timestamptz not null,
  requested_ends_at timestamptz not null,
  counter_starts_at timestamptz,
  counter_ends_at timestamptz,
  status text not null default 'pending_artisan'
    check (status in ('pending_artisan','pending_customer','accepted','rejected','withdrawn')),
  request_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_ends_at > requested_starts_at),
  check ((counter_starts_at is null and counter_ends_at is null)
      or (counter_starts_at is not null and counter_ends_at is not null and counter_ends_at > counter_starts_at)),
  foreign key (owner_user_id, job_id, appointment_id)
    references public.appointments(owner_user_id, job_id, id) on delete cascade,
  unique (owner_user_id, id)
);

create table if not exists public.job_media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  kind text not null check (kind in ('image','audio')),
  origin text not null check (origin in ('artisan','customer')),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  storage_bucket text not null check (storage_bucket in ('job-images','job-audio')),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 4194304),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs(owner_user_id, id) on delete cascade,
  check (
    (kind = 'audio' and origin = 'artisan' and visibility = 'private' and storage_bucket = 'job-audio')
    or (kind = 'image' and storage_bucket = 'job-images' and
       (origin = 'artisan' or (origin = 'customer' and visibility = 'shared')))
  )
);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  job_id uuid not null,
  event_type text not null,
  actor_type text not null check (actor_type in ('artisan','link_holder','system')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs(owner_user_id, id) on delete cascade
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid,
  category text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (owner_user_id, job_id)
    references public.jobs(owner_user_id, id) on delete cascade
);

create index if not exists customers_owner_name_idx on public.customers(owner_user_id, name);
create index if not exists customer_addresses_owner_idx on public.customer_addresses(owner_user_id, customer_id);
create index if not exists jobs_owner_status_updated_idx on public.jobs(owner_user_id, status, updated_at desc);
create index if not exists jobs_customer_idx on public.jobs(owner_user_id, customer_id, created_at desc);
create index if not exists appointments_owner_start_idx on public.appointments(owner_user_id, starts_at, ends_at)
  where status = 'scheduled';
create index if not exists appointments_job_idx on public.appointments(owner_user_id, job_id, created_at);
create index if not exists requests_job_idx on public.appointment_requests(owner_user_id, job_id, created_at desc);
create unique index if not exists requests_one_open_per_appointment_idx
  on public.appointment_requests(appointment_id)
  where status in ('pending_artisan', 'pending_customer');
create index if not exists job_media_job_idx on public.job_media(owner_user_id, job_id, created_at desc)
  where deleted_at is null;
create index if not exists job_events_job_idx on public.job_events(owner_user_id, job_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(owner_user_id, created_at desc)
  where read_at is null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Idempotent trigger definitions (Postgres supports DROP TRIGGER IF EXISTS).
do $$
declare t text;
begin
  foreach t in array array['profiles','customers','customer_addresses','jobs','appointments','appointment_requests'] loop
    execute format('drop trigger if exists %I on public.%I', 'touch_' || t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', 'touch_' || t || '_updated_at', t);
  end loop;
end $$;

-- Explicitly lock down API access; guests NEVER query app tables directly.
do $$
declare t text;
begin
  foreach t in array array['profiles','customers','customer_addresses','jobs','appointments','appointment_requests','job_media','job_events','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Artisan can CRUD own jobs/customers/appointments and related operational records.
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.customers, public.customer_addresses,
  public.jobs, public.appointments, public.appointment_requests, public.job_media to authenticated;
grant select on public.job_events, public.notifications to authenticated;

create policy "profiles owner read" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "customers owner select" on public.customers
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "customers owner insert" on public.customers
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "customers owner update" on public.customers
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "customers owner delete" on public.customers
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "addresses owner select" on public.customer_addresses
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "addresses owner insert" on public.customer_addresses
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "addresses owner update" on public.customer_addresses
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "addresses owner delete" on public.customer_addresses
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "jobs owner select" on public.jobs
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "jobs owner insert" on public.jobs
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "jobs owner update" on public.jobs
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "jobs owner delete" on public.jobs
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "appointments owner select" on public.appointments
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "appointments owner insert" on public.appointments
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "appointments owner update" on public.appointments
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "appointments owner delete" on public.appointments
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "appointment requests owner select" on public.appointment_requests
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "appointment requests owner insert" on public.appointment_requests
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "appointment requests owner update" on public.appointment_requests
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "appointment requests owner delete" on public.appointment_requests
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "media owner select" on public.job_media
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "media owner insert" on public.job_media
  for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy "media owner update" on public.job_media
  for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "media owner delete" on public.job_media
  for delete to authenticated using (owner_user_id = (select auth.uid()));

create policy "events owner select" on public.job_events
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "notifications owner select" on public.notifications
  for select to authenticated using (owner_user_id = (select auth.uid()));

-- Storage: private buckets. Guest media operations go via trusted backend only.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-images','job-images',false,2097152,array['image/jpeg','image/png','image/webp']),
  ('job-audio','job-audio',false,4194304,array['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/x-m4a','audio/mp4a-latm'])
on conflict (id) do nothing;

-- Path layout: <owner-uuid>/<job-uuid>/<random-filename>. Keep private media ACLs.
create policy "artisan image/audio view" on storage.objects
  for select to authenticated using (
    bucket_id in ('job-images','job-audio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "artisan image/audio upload" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('job-images','job-audio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "artisan image/audio delete" on storage.objects
  for delete to authenticated using (
    bucket_id in ('job-images','job-audio')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- REQUIRED FOLLOW-UP WORK BY CODING AGENT:
-- 1) Implement secure, atomic SQL RPCs for job cancellation/reschedule acceptance
--    /counteroffer commitment (verify status/version; prevent race conditions).
-- 2) Implement signed job-link HMAC verification and public guest API routes.
-- 3) Implement upload/delete sequences, cleanup, rate-limits; test signed-url exposure.
-- 4) Implement read-only permission checks for inactive/revoked accounts if used.
-- 5) Validate all RLS/Storage policies with distinct user sessions and guest API tests.
-- 6) Do not give guest direct access to any table/storage API via anon key.
