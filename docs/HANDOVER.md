# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M6.1** (admin panel scope-change docs) is complete and committed. The deferred M5 phone checks **D1–D7** are still open.

## Last completed task
**M6.1**: admin panel scope change (spec v1.5, plan v3.2, CLAUDE.md, DATA_MODEL, README, setup and privacy docs), approved by the owner.

## Current or interrupted task
None.

## Key decisions (still relevant)
- **Admin panel (plan v3.2, owner 2026-10-18):** `/admin` (English route by owner choice), one admin = separate auth user with `app_metadata.role = admin` and no profile, password + TOTP (`aal2`) required, everyone else 404. Deactivate = auth ban + delete push subscriptions; customer links keep working. Counts only, no customer personal data. Server-side admin client; no RPC, migration or chart library. Tasks M6.1–M6.4; old M6.1–M6.3 → M6.5–M6.7. Spec v1.5 §2.1, plan §4.1, decisions A-1…A-5.
- **Reschedule (M5.3):** the customer always negotiates the job's next appointment; a new request replaces the open one (also a counter) in one transaction; the swap lives only in the internal `reschedule_swap`. Artisan approve of a passed time → `expired`. The two appointment self-reference FKs are deferrable (checked at commit), otherwise job/account deletes fail after a swap.
- **Freshness (T-14, owner 2026-10-18):** no Realtime; `AutoRefresh` refreshes on visibility/focus + every 30 s while visible, not while a sheet is open (sheets with `data-state="closed"` ignored) or a text field is focused. Push covers closed apps.
- **Service worker (M5.5):** network-only navigations with an offline fallback, never caches HTML/API, ignores `/t/*`; push payload contract `{title, body, url, tag}` (url = same-origin path, tag = dedupe key). Registered only in production builds, so test PWA behaviour with `npm run build && npm run start` (`prod-check`), and unregister it in the pane afterwards.
- **Push (M5.6):** `sendPush` is the only sender (admin client); a device belongs to the artisan who enabled it last; "on" requires the server row (never auto-subscribe); logout deletes this device's row. VAPID: `.env.local` + Vercel Production (private key sensitive, can't be read back).
- **Push status flow (M5.7):** `pending` → claim (`sending`, attempts+1) → `sent` / `skipped` / `failed` (+ `push_next_attempt_at` 5 min, 15 min, none after 3). M5.8's dispatcher must also pick up `failed` rows that are due and rows stuck in `sending` (a killed function).
- **Dispatcher (M5.8):** every 5 min via `ustaplan-dispatch` (pg_cron → pg_net, Vault `app_base_url` + `cron_secret`). Pending pushes older than 1 h are skipped, never sent late. Any dispatcher run (also a local one against dev) sends real pushes to subscribed devices.
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

## Tests executed (M6.1)
Docs only. A grep for stale `v1.4` / `37 tasks` / old M6 numbers is clean (the remaining hits are historical entries). There's nothing to typecheck or build.

## Known bugs and blockers
- `npm audit`: high advisories only in dev tooling; accepted.
- Supabase advisor: leaked-password protection is off (owner decides before the pilot, M6.7).
- KVKK legal review of `/gizlilik` and the cross-border transfer: open, blocks only M6.7.
- `APP_BASE_URL` exists only for Production on Vercel.

## Environment
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL` (Production), `SHARE_LINK_SECRET` (Production + Preview, separate values), `SUPABASE_SECRET_KEY` (Production, **dev** project). Local folder linked to the Vercel project (`.vercel/`, git-ignored); `vercel link` appends a `VERCEL_OIDC_TOKEN` to `.env.local`, which was removed. Test data on dev (C, fake): customer "Çağlar Öztürk" with several test jobs, photos and visits.

## Uncommitted changes
None. These local commits aren't pushed yet: `5394618`, `228873e` and the M6.1 commit (docs only).

## Exact next action
1. **M6.2**, only when the owner says "start the next task": `requireAdmin()`, the `/admin` shell, TOTP enrollment and challenge, login redirects, `scripts/create-admin.ts`. Check the current Supabase MFA docs and `getClaims()`/AAL docs first. Creating the admin account in dev needs approval.
2. Separately with the owner: the phone checks D1–D7.

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git diff --stat && git log --oneline -5
```
