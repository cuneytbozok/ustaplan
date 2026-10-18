# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M5.4** (inbox + auto-refresh) is complete: deployed (`35b317e`, `aad04ec`) and confirmed on the owner's phones. Next: **M5.5** (PWA `sw.js` + install guide), on the owner's instruction.

## Last completed task
**M5.4** (`35b317e`, `aad04ec`): bell with unread badge, `/bildirimler` (mark read, mark all, Geri), `lib/push/render.ts`, `AutoRefresh` (T-14) in the artisan shell and on the customer page.

## Current or interrupted task
None.

## Key decisions (still relevant)
- **Reschedule (M5.3):** the customer always negotiates the job's next appointment; a new request replaces the open one (also a counter) in one transaction; the swap lives only in the internal `reschedule_swap`. Artisan approve of a passed time → `expired`. The two appointment self-reference FKs are deferrable (checked at commit), otherwise job/account deletes fail after a swap.
- **Freshness (T-14, owner 2026-10-18):** no Realtime; `AutoRefresh` refreshes on visibility/focus + every 30 s while visible, not while a sheet is open (sheets with `data-state="closed"` ignored) or a text field is focused. Push covers closed apps.
- **Inbox copy:** only `lib/push/render.ts` turns category + payload into text; M5.7 pushes must reuse it.
- **Browser tests:** stale hidden copies of earlier pages can hold buttons with the same label; target the visible page (`find`/refs) and verify writes in the DB.
- **Customer photos (M5.2):** route handlers with the admin client, no RPC (DATA_MODEL §4). Limits are counted from `job_media` and can overshoot by one or two under concurrency. The daily `customer_photo_added` item is insert-then-update on conflict (a lost increment under a race is accepted). Only JPEG is accepted; the browser always re-encodes to JPEG.
- **Customer cancel (M5.1):** already cancelled → `ok` with no change; completed → refused. The note stays on the job row only (not in events or notifications). A re-cancel after reopen re-arms the same `cancel:<job>` notification. No separate rate limit: cancel is self-limiting. Origin must equal `APP_BASE_URL` exactly, so a local server on another port needs a matching `APP_BASE_URL` (see `prod-check`).
- **Customer links:** token = `<jobId>.<base64url HMAC>` (`lib/share-link.ts`, pure). `proxy.ts` verifies `/t/:token` and rewrites every invalid link to static `/t/gecersiz` (`notFound()` at prerender → real 404, identical body); the page and the media proxy verify again. Only `CustomerJobView` (`lib/public-job.ts`) reaches the customer. The customer endpoints use the admin client, so production needs `SUPABASE_SECRET_KEY`.
- **Security check:** needs a running **production** build for the link section: `npm run build && npm run start`, then `npm run security-check` (`next dev` adds debug output to error pages). An unreachable app is a FAIL.
- **Media:** prepared in the browser (≤ 1600 px JPEG, no EXIF/GPS; lazy `heic2any`); the server rebuilds storage paths from the session and checks size + magic bytes before inserting `job_media`. Voice notes prefer `audio/mp4`.
- **Forms/navigation:** every Server Action redirect uses `RedirectType.replace`; edit forms go back after `ok`; "Geri" uses history only after in-app navigation (`NavigationMarker`).
- **Cache Components:** each page keeps request-time reads in its own `<Suspense>`; `Date.now()` only via `lib/domain/time.ts` / `scheduling.ts` helpers; `/t/[token]` uses `export const instant = false`.
- **Browser tests:** Next keeps earlier pages mounted but hidden, so filter DOM queries by visibility, and re-take screenshots (they can lag after navigation).

## Tests executed (M5.4)
security-check 235/235 on a production build (:3200); Vitest 31/31; typecheck, lint, build; local 375 px: auto-refresh on Bugün and the customer page, inbox open/mark read/mark all, refresh guard with an open sheet, closed link on refresh.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review of `/gizlilik` and cross-border transfer: open, blocks only M6.3.
- `APP_BASE_URL` exists only for Production on Vercel, so preview deployments can't build share links (the sheet says so).

## Environment
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL` (Production), `SHARE_LINK_SECRET` (Production + Preview, separate values), `SUPABASE_SECRET_KEY` (Production, **dev** project). Local folder linked to the Vercel project (`.vercel/`, git-ignored); `vercel link` appends a `VERCEL_OIDC_TOKEN` to `.env.local`, which was removed. Test data on dev (C, fake): customer "Çağlar Öztürk" with several test jobs, photos and visits.

## Uncommitted changes
None. The M5.4 close-out commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M5.5**: `public/sw.js` per plan §9 (push handler shows the notification with `tag` = dedupe key, `notificationclick` focuses or opens the job, offline fallback page only, never caches HTML or API responses, ignores `/t/*`), its registration, and the install guide (iPhone "Ana Ekrana Ekle" steps, Android install) — manifest and icons already exist (M1.5, T-11). Check current Next.js PWA docs first. Run `npm run build` (service worker = significant change).

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
