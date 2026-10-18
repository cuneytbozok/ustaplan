-- cron (M5.8): the single 5-minute schedule (DATA_MODEL §7). Supabase Cron
-- (pg_cron) calls the dispatcher through pg_net with the bearer secret.
-- The base URL and the secret are read from Supabase Vault at run time under
-- the names app_base_url and cron_secret; their values are inserted once per
-- project by the administrator (scripts/vault-secrets.sql.example) and are
-- never committed. Until they exist the call simply fails and is retried in
-- five minutes. Forward-only; contains no secrets or environment URLs.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'ustaplan-dispatch',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/internal/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
