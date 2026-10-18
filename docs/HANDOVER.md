# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M5.1** (customer cancel) is implemented, applied to dev and verified locally; it waits for the owner's phone check on the deployed URL, which needs an approved push.

## Last completed task
**M4.5** (`7b6416e`, M4 complete; closed in `89d385a` after the two-phone check).

## Current or interrupted task
**M5.1 — In Progress (phone check pending).** Done: migration `20261018060734_customer_cancel.sql` (`public_cancel_job`, service_role only) on dev with approval, types regenerated; `POST /api/t/[token]/cancel`; `CancelSheet` on `/t/[token]`; security-check 167/167; local 375 px smoke. Files: the migration, `src/app/api/t/[token]/cancel/route.ts`, `src/components/public/cancel-sheet.tsx`, `src/lib/customer-api.ts` (new); `customer-link.ts` (returns `shareVersion`), media route (uses `customer-api`), `t/[token]/page.tsx`, `security-check.ts`, `database.ts`, DATA_MODEL §4, plan §5, `.claude/launch.json` (`prod-check` on :3200).

## Key decisions (still relevant)
- **Customer cancel (M5.1):** already cancelled → `ok` with no change; completed → refused. The note stays on the job row only (not in events or notifications). A re-cancel after reopen re-arms the same `cancel:<job>` notification. No separate rate limit: cancel is self-limiting. Origin must equal `APP_BASE_URL` exactly, so a local server on another port needs a matching `APP_BASE_URL` (see `prod-check`).
- **Customer links:** token = `<jobId>.<base64url HMAC>` (`lib/share-link.ts`, pure). `proxy.ts` verifies `/t/:token` and rewrites every invalid link to static `/t/gecersiz` (`notFound()` at prerender → real 404, identical body); the page and the media proxy verify again. Only `CustomerJobView` (`lib/public-job.ts`) reaches the customer. The customer endpoints use the admin client, so production needs `SUPABASE_SECRET_KEY`.
- **Security check:** needs a running **production** build for the link section: `npm run build && npm run start`, then `npm run security-check` (`next dev` adds debug output to error pages). An unreachable app is a FAIL.
- **Media:** prepared in the browser (≤ 1600 px JPEG, no EXIF/GPS; lazy `heic2any`); the server rebuilds storage paths from the session and checks size + magic bytes before inserting `job_media`. Voice notes prefer `audio/mp4`.
- **Forms/navigation:** every Server Action redirect uses `RedirectType.replace`; edit forms go back after `ok`; "Geri" uses history only after in-app navigation (`NavigationMarker`).
- **Cache Components:** each page keeps request-time reads in its own `<Suspense>`; `Date.now()` only via `lib/domain/time.ts` / `scheduling.ts` helpers; `/t/[token]` uses `export const instant = false`.
- **Browser tests:** Next keeps earlier pages mounted but hidden, so filter DOM queries by visibility, and re-take screenshots (they can lag after navigation).

## Tests executed (M5.1)
PGlite 35/35 (scratchpad harness: core + jobs + appointments + customer_cancel); security-check 167/167 against a production build on :3200; typecheck, lint, Vitest 30/30, build; local 375 px customer → artisan → reopen smoke.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review of `/gizlilik` and cross-border transfer: open, blocks only M6.3.
- `APP_BASE_URL` exists only for Production on Vercel, so preview deployments can't build share links (the sheet says so).

## Environment
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL` (Production), `SHARE_LINK_SECRET` (Production + Preview, separate values), `SUPABASE_SECRET_KEY` (Production, **dev** project). Local folder linked to the Vercel project (`.vercel/`, git-ignored); `vercel link` appends a `VERCEL_OIDC_TOKEN` to `.env.local`, which was removed. Test data on dev (C, fake): customer "Çağlar Öztürk" with several test jobs, photos and visits.

## Uncommitted changes
None after the M5.1 commit. Local commits not yet pushed: `89d385a` and the M5.1 commit.

## Exact next action
Ask the owner to approve the push (deploys to Vercel). Then the owner, on a phone: share a job link, open it, cancel with a reason ("Diğer" needs a note), check the job shows "Müşteri iptal etti" with the reason, reopen it and check the same link offers cancel again. If it works, mark M5.1 Completed in PROGRESS (status, log row) and stop. Next task after that: **M5.2** (customer photo upload/delete).

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git log --oneline -15
```
```bash
npm ci && npm run typecheck && npm run lint && npm test
```
Security check (production build; ports 3000/3100 may be busy): build, start `prod-check` from `.claude/launch.json`, then
```bash
APP_BASE_URL=http://localhost:3200 SECURITY_CHECK_BASE_URL=http://localhost:3200 npm run security-check
```
