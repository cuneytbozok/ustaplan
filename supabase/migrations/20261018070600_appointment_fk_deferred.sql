-- appointment_fk_deferred (M5.3 fix): deleting a job (admin cleanup, or an
-- account deletion cascading from profiles) failed once a reschedule had been
-- accepted. The cascade removes appointments and their requests, but the plain
-- NO ACTION checks on appointment_requests.resulting_appointment_id and
-- appointments.replaced_by_id could fire before the cascade had removed the
-- referencing rows. Checking them at commit fixes that; nothing else changes
-- (the app never deletes appointments, and every RPC writes both sides of a
-- swap in one transaction). Forward-only; no secrets or environment URLs.

alter table public.appointment_requests
  alter constraint appointment_requests_owner_user_id_job_id_resulting_appoin_fkey deferrable initially deferred;

alter table public.appointments
  alter constraint appointments_owner_user_id_job_id_replaced_by_id_fkey deferrable initially deferred;
