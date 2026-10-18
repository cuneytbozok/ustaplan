# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M5.2** (customer photo upload/delete) is complete: deployed (`00c6ceb`) and confirmed on the owner's phone. Next: **M5.3** 🔑 (migration `reschedule`), on the owner's instruction.

## Last completed task
**M5.2** (`00c6ceb`): `POST/DELETE /api/t/[token]/photos`, `CustomerPhotos` on the customer page, daily `customer_photo_added` inbox item, security-check 194/194. No migration.

## Current or interrupted task
None.

## Key decisions (still relevant)
- **Customer photos (M5.2):** route handlers with the admin client, no RPC (DATA_MODEL §4). Limits are counted from `job_media` and can overshoot by one or two under concurrency. The daily `customer_photo_added` item is insert-then-update on conflict (a lost increment under a race is accepted). Only JPEG is accepted; the browser always re-encodes to JPEG.
- **Customer cancel (M5.1):** already cancelled → `ok` with no change; completed → refused. The note stays on the job row only (not in events or notifications). A re-cancel after reopen re-arms the same `cancel:<job>` notification. No separate rate limit: cancel is self-limiting. Origin must equal `APP_BASE_URL` exactly, so a local server on another port needs a matching `APP_BASE_URL` (see `prod-check`).
- **Customer links:** token = `<jobId>.<base64url HMAC>` (`lib/share-link.ts`, pure). `proxy.ts` verifies `/t/:token` and rewrites every invalid link to static `/t/gecersiz` (`notFound()` at prerender → real 404, identical body); the page and the media proxy verify again. Only `CustomerJobView` (`lib/public-job.ts`) reaches the customer. The customer endpoints use the admin client, so production needs `SUPABASE_SECRET_KEY`.
- **Security check:** needs a running **production** build for the link section: `npm run build && npm run start`, then `npm run security-check` (`next dev` adds debug output to error pages). An unreachable app is a FAIL.
- **Media:** prepared in the browser (≤ 1600 px JPEG, no EXIF/GPS; lazy `heic2any`); the server rebuilds storage paths from the session and checks size + magic bytes before inserting `job_media`. Voice notes prefer `audio/mp4`.
- **Forms/navigation:** every Server Action redirect uses `RedirectType.replace`; edit forms go back after `ok`; "Geri" uses history only after in-app navigation (`NavigationMarker`).
- **Cache Components:** each page keeps request-time reads in its own `<Suspense>`; `Date.now()` only via `lib/domain/time.ts` / `scheduling.ts` helpers; `/t/[token]` uses `export const instant = false`.
- **Browser tests:** Next keeps earlier pages mounted but hidden, so filter DOM queries by visibility, and re-take screenshots (they can lag after navigation).

## Tests executed (M5.2)
security-check 194/194 against a production build on :3200; typecheck, lint, Vitest 30/30, build; local 375 px upload → artisan view → delete smoke.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review of `/gizlilik` and cross-border transfer: open, blocks only M6.3.
- `APP_BASE_URL` exists only for Production on Vercel, so preview deployments can't build share links (the sheet says so).

## Environment
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL` (Production), `SHARE_LINK_SECRET` (Production + Preview, separate values), `SUPABASE_SECRET_KEY` (Production, **dev** project). Local folder linked to the Vercel project (`.vercel/`, git-ignored); `vercel link` appends a `VERCEL_OIDC_TOKEN` to `.env.local`, which was removed. Test data on dev (C, fake): customer "Çağlar Öztürk" with several test jobs, photos and visits.

## Uncommitted changes
None. The M5.2 close-out commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M5.3** 🔑: migration `reschedule` with `public_request_reschedule`, `public_withdraw_request`, `public_accept_counter` (service_role only, lock + share-version re-check, one open negotiation per appointment, ≤ 10 requests per day per job, notifications `reschedule_requested` / `counter_accepted` / `request_withdrawn`) and the artisan's `respond_to_request` (approve/reject/counter with the atomic swap, plan §8); customer UI on `/t/[token]` and the artisan UI (job page + Bugün pending requests). Test in PGlite, then **ask before `supabase db push`**; regenerate types; extend and re-run security-check.

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
