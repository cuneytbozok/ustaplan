# MVP Local / Supabase / Vercel setup checklist

## Supabase

- [ ] Create **two** Free projects: `ustaplan-dev` (created in Ireland `eu-west-1`, accepted for fake data, plan T-10) at the start of development (fake data only) and `ustaplan-prod` in Frankfurt (eu-central-1) at pilot launch (real data only). Securely store their URLs and keys. No Docker or local Supabase is used; migrations go out with `supabase link` + `supabase db push`, each with owner approval.
- [ ] Disable public new-user signups in the **Auth configuration**. There must be no public signup route or active API signup path. Verify by testing a signup attempt.
- [ ] Keep email/password sign-in available; configure authenticated admin-created accounts appropriately (admin `createUser` with `email_confirm` as required so no invitation email is necessary).
- [ ] Apply and review the hand-written migrations (`supabase/migrations/`) derived from [`03_SCHEMA_STARTER.sql`](../architecture/03_SCHEMA_STARTER.sql), not the starter blindly; enable/test owner-scoped RLS on every public table, and verify any required Data API grants.
- [ ] Ensure job-images and job-audio are **private** Storage buckets with MIME and size limits.
- [ ] Configure separate trusted environment variables for server-only secret key and strong HMAC share-link signing key. Never expose them with `NEXT_PUBLIC_`.
- [ ] Use a trusted local admin script to create pilot artisans with `auth.admin.createUser({email,password,email_confirm:true})`, then create `profiles` row. Don't place temporary passwords in source files, command history or git.
- [ ] Confirm authenticated user can change password in settings using the current Supabase Auth-supported flow; manual administrator reset uses server-side `updateUserById`.
- [ ] Test artisan A cannot read/write artisan B rows or files, including via guessed UUIDs; customer link does not reveal personal data or non-shared media.
- [ ] Enable `pg_cron` and `pg_net`; store `app_base_url` and `cron_secret` in Supabase Vault (`scripts/vault-secrets.sql.example`); the `cron` migration creates the single 5-minute dispatch schedule (IMPLEMENTATION_PLAN §9).
- [ ] Make a backup/export plan; Supabase Free does not replace operational backups. Monitor DB/Storage consumption.

## PWA & Vercel

- [ ] Run typecheck, lint, build, the critical Vitest tests and `scripts/security-check.ts` (against dev).
- [ ] Configure Vercel project environment variables with **server secret values only in server scope**.
- [ ] Set `APP_BASE_URL` (server-side) for the deployed canonical domain (pilot: the `vercel.app` subdomain) and test WhatsApp share link construction. Treat previews carefully: shared production links should not point to short-lived preview URLs.
- [ ] Ensure private customer pages and job API responses send `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`.
- [ ] Smoke-test on the available phones (iOS Safari / Android Chrome, around 360–430 px), plus the PWA install path. Use the production `vercel.app` URL; preview URLs sit behind Vercel login.
- [ ] Test job photo capture and voice MediaRecorder support on real phones. Show fallback on unsupported devices.
- [ ] Run scenarios: create job without appointment; schedule with conflict warning; request change; counteroffer; accept; customer cancel with mandatory reason; upload & delete customer photo; shared link rotate/revoke; reopen cancelled job.
- [ ] Generate VAPID keys once; set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (server only), `VAPID_SUBJECT`, `CRON_SECRET` (server only).
- [ ] Test Web Push on a physical Android phone and on an iPhone (iOS 16.4+) with the PWA added to the Home Screen, including while the app is closed: immediate (cancel, reschedule request, counter accepted) and scheduled (1 h reminder, daily follow-up).
- [ ] Check the customer page links to `/gizlilik` and the manual data-deletion process in `docs/setup/PRIVACY_AND_DATA_REQUESTS.md` is understood by the administrator.
- [ ] Observe bandwidth, database, storage and function limits during pilot.
- [ ] **Terms reminder:** Vercel Hobby has a non-commercial-use condition even though its capacity may be sufficient for 1–2 users. Resolve plan eligibility before any commercial deployment; Vercel Pro or an eligible alternate host may be required.

## Scope discipline

Do not add AI, automated WhatsApp sending, OTP, customer accounts, accounting, online payments or marketplace discovery to this MVP.
