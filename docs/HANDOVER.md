# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M5.7** (immediate pushes for cancel, date request, counter accepted) is implemented and verified locally; it waits for the owner's phone check on the deployed URL, which needs an approved push. M5.1–M5.6 are complete.

## Last completed task
**M5.6** (`b46cd95`, `2836a48`, closed in `d74b9fc`): Web Push subscriptions + test push, confirmed on the owner's iPhone.

## Current or interrupted task
**M5.7 — In Progress (phone check pending).** Files: `src/lib/push.ts` (`deliverNotification`), `src/lib/push/target.ts`, `src/lib/domain/request-outcome.ts`, the cancel / reschedule (POST + DELETE) / reschedule-accept routes (`after()`), `isler/[id]/page.tsx` (banner), `bildirimler/page.tsx` + `inbox-list.tsx` (status chips), `render.ts`, `pwa/push-settings.tsx` (help text), `scripts/security-check.ts`, plan (T-15, §9), DATA_MODEL.

## Key decisions (still relevant)
- **Reschedule (M5.3):** the customer always negotiates the job's next appointment; a new request replaces the open one (also a counter) in one transaction; the swap lives only in the internal `reschedule_swap`. Artisan approve of a passed time → `expired`. The two appointment self-reference FKs are deferrable (checked at commit), otherwise job/account deletes fail after a swap.
- **Freshness (T-14, owner 2026-10-18):** no Realtime; `AutoRefresh` refreshes on visibility/focus + every 30 s while visible, not while a sheet is open (sheets with `data-state="closed"` ignored) or a text field is focused. Push covers closed apps.
- **Service worker (M5.5):** network-only navigations with an offline fallback, never caches HTML/API, ignores `/t/*`; push payload contract `{title, body, url, tag}` (url = same-origin path, tag = dedupe key). Registered only in production builds, so test PWA behaviour with `npm run build && npm run start` (`prod-check`), and unregister it in the pane afterwards.
- **Push (M5.6):** `sendPush` is the only sender (admin client); a device belongs to the artisan who enabled it last; "on" requires the server row (never auto-subscribe); logout deletes this device's row. VAPID: `.env.local` + Vercel Production (private key sensitive, can't be read back).
- **Push status flow (M5.7):** `pending` → claim (`sending`, attempts+1) → `sent` / `skipped` / `failed` (+ `push_next_attempt_at` 5 min, 15 min, none after 3). M5.8's dispatcher must also pick up `failed` rows that are due and rows stuck in `sending` (a killed function).
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

## Tests executed (M5.7)
security-check 239/239 on a production build (push claimed and processed once per event, retry time, skipped without devices, no resend on repeats); typecheck, lint, build.

## Known bugs and blockers
- `npm audit`: high advisories only in dev tooling (ESLint chain, shadcn CLI: braces/micromatch); accepted, none in runtime packages.
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review of `/gizlilik` and cross-border transfer: open, blocks only M6.3.
- `APP_BASE_URL` exists only for Production on Vercel, so preview deployments can't build share links (the sheet says so).

## Environment
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL` (Production), `SHARE_LINK_SECRET` (Production + Preview, separate values), `SUPABASE_SECRET_KEY` (Production, **dev** project). Local folder linked to the Vercel project (`.vercel/`, git-ignored); `vercel link` appends a `VERCEL_OIDC_TOKEN` to `.env.local`, which was removed. Test data on dev (C, fake): customer "Çağlar Öztürk" with several test jobs, photos and visits.

## Uncommitted changes
None after the M5.7 commit. Local commits not yet pushed: `d74b9fc` and the M5.7 commit.

## Exact next action
Ask the owner to approve the push (deploys to Vercel). Then the owner, with notifications on and the UstaPlan app closed: request a new date, then withdraw it before opening → the withdrawal push replaces the request push; tap → job with the banner; inbox shows "Geri çekildi". Also: from the customer link on a second phone, ask for a new date → a push "<Ad> yeni tarih istedi" arrives; tap it → the job opens; counter on the artisan phone, accept on the customer phone → "… önerdiğin saati kabul etti"; cancel → "… işi iptal etti · <sebep>". Each arrives once. If it works, mark M5.7 Completed in PROGRESS (status, log row) and stop. Next task after that: **M5.8** 🔑 (dispatcher: reminders, digest, retries incl. stuck `sending`, cleanup; migration `cron`; Vault secrets — approvals needed).

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
