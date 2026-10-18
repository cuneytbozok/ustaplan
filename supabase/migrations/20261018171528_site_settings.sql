-- Site settings for the owner's admin panel (plan L-2). One row per known key;
-- read and written only by the server with the secret key (service_role).
-- RLS on and no policies: artisans and visitors can't see or change anything.

create table public.app_settings (
  key text primary key check (key in ('search_visibility')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.app_settings enable row level security;

create trigger touch_app_settings_updated_at before update on public.app_settings
  for each row execute function public.touch_updated_at();

revoke all on table public.app_settings from anon, authenticated;
