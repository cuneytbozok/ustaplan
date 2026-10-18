# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
Admin panel **M6.1–M6.4** and **M6.6** are complete and deployed. **M6.5** (phone smoke pass) and **M6.7** (prod) are blocked on the owner. Open owner checks: **D1–D9** (PROGRESS).

## Last completed task
**M6.6**: `backup.sh` (+ `backup-storage.ts` / `restore-storage.ts`), `export-customer-data.ts`, `delete-customer-data.ts`, `docs/setup/RUNBOOK.md`.

## Current or interrupted task
None. M6.5 and M6.7 are **Blocked** (owner phones; KVKK review + prod approvals).

## Key decisions (still relevant)
- **Admin panel (plan v3.2, §4.1, A-1…A-6):** `/admin` (English route by owner choice, Turkish copy). One admin = auth user with `app_metadata.role = admin` and no profile. Gate: proxy (non-admins get a real 404; aal1 admins → `/admin/mfa`; admins kept out of artisan routes) + `getAdminGate`/`requireAdmin` in every page (pages render in parallel with layouts) + every admin action checks role + aal2 itself. Counts only, never customer data. Deactivate = ban + delete push subscriptions; refresh refused at once, an issued access token works ≤ 1 h (`getClaims` is local). Temporary passwords shown once, never logged.
- **Account logic** lives in `lib/admin/accounts.ts` (artisans only), shared by the panel and the scripts. **Figures** in `lib/admin/stats.ts` (paged reads past the 1000-row cap; Istanbul day/ISO week/month).
- **Security check** now also covers the admin panel (`scripts/security-check-admin.ts`): real ssr cookies over HTTP, a temporary fake admin with TOTP enrolled by the script, and server actions called by their ids from `.next/server/server-reference-manifest.json`, so **build before running it**.
- **Data scripts** refuse output inside the repository; erasure = objects → jobs → customer, idempotent. Closed accounts' files are removed by the nightly cleanup.
- Earlier decisions (reschedule, freshness T-14, service worker, push flow, dispatcher, customer links, Cache Components, browser-test quirks) are unchanged; see plan §15 and PROGRESS.
- **Credentials rule for agents:** test credentials only on local hosts; the deployed `vercel.app` login is the owner's check (D8).

## Tests executed
security-check **288/288** against a local production build (:3200, after the last code change); test 31/31; typecheck, lint, build pass. Overview figures matched independent Postgres counts. Data scripts dry-run on dev. Deployed `a78dc61`: `/admin` serves no-store + noindex + login redirect.

## Known bugs and blockers
- KVKK legal review: open, blocks M6.7. Leaked-password protection decision before the pilot.
- `npm audit`: high advisories only in dev tooling; accepted.
- Vercel MCP has no access to this team scope and there's no local Vercel CLI; deploys are verified over HTTP.
- `APP_BASE_URL` exists only for Production on Vercel.

## Environment
Dev Supabase `xytwwudbnykackuxfeif` (Ireland), Vercel `ustaplan` → https://ustaplan.vercel.app (Production on dev data). Dev now also has a fake artisan **Test Usta D** (`usta-d@ustaplan.test`, created through the panel; password not kept). No admin account exists in dev (the fake test admin was deleted); the owner creates theirs (D8).

## Uncommitted changes
None after the M6 wrap-up commit (pushed).

## Exact next action
D8 done (owner, TOTP works, password changed). KVKK, backups (D9) and other launch items are parked by the owner in `docs/setup/PRE_LAUNCH_CHECKLIST.md`, to do at the end. Next with the owner: the M6.5 scenarios S1–S11 + D1–D7 on the phones. Report failures; fixes go into the task they came from. M6.7 only after the KVKK review, with approval for each external step.

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git log --oneline -10
```
```bash
npm ci && npm run typecheck && npm run lint && npm test
```
Security check: `npm run build`, start `prod-check` (.claude/launch.json), then
```bash
APP_BASE_URL=http://localhost:3200 SECURITY_CHECK_BASE_URL=http://localhost:3200 npm run security-check
```
