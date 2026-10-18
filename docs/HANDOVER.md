# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M4 is complete** (photos, voice notes, signed customer links, share sheet, `/gizlilik`, security-check v2), deployed and verified on the owner's phones. Next: **M5.1** 🔑 (migration `customer_cancel`), on the owner's instruction.

## Last completed task
**M4.3 + M4.4** (`ade1965`, `c198e9d`, deployed `7b6416e`): owner shared a link by WhatsApp, opened it on a second phone, regenerated it and confirmed the old one is dead. **M4.5** (`7b6416e`): security-check 148/148.

## Current or interrupted task
None.

## Key decisions (still relevant)
- **Customer links:** token = `<jobId>.<base64url HMAC>` (`lib/share-link.ts`, pure). `proxy.ts` verifies `/t/:token` and rewrites every invalid link to static `/t/gecersiz` (`notFound()` at prerender → real 404, identical body); the page and the media proxy verify again. Only `CustomerJobView` (`lib/public-job.ts`) reaches the customer. The customer endpoints use the admin client, so production needs `SUPABASE_SECRET_KEY`.
- **Security check:** needs a running **production** build for the link section: `npm run build && npm run start`, then `npm run security-check` (`next dev` adds debug output to error pages). An unreachable app is a FAIL.
- **Media:** prepared in the browser (≤ 1600 px JPEG, no EXIF/GPS; lazy `heic2any`); the server rebuilds storage paths from the session and checks size + magic bytes before inserting `job_media`. Voice notes prefer `audio/mp4`.
- **Forms/navigation:** every Server Action redirect uses `RedirectType.replace`; edit forms go back after `ok`; "Geri" uses history only after in-app navigation (`NavigationMarker`).
- **Cache Components:** each page keeps request-time reads in its own `<Suspense>`; `Date.now()` only via `lib/domain/time.ts` / `scheduling.ts` helpers; `/t/[token]` uses `export const instant = false`.
- **Browser tests:** Next keeps earlier pages mounted but hidden, so filter DOM queries by visibility, and re-take screenshots (they can lag after navigation).

## Tests executed (M4)
Vitest 30/30 (share-link, public-dto, scheduling); security-check 148/148 on a production build; live checks on `ustaplan.vercel.app` (identical 404s, headers); owner's iPhone (HEIC photo stored without GPS, voice notes) and second-phone link test.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review of `/gizlilik` and cross-border transfer: open, blocks only M6.3.
- `APP_BASE_URL` exists only for Production on Vercel, so preview deployments can't build share links (the sheet says so).

## Environment
Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL` (Production), `SHARE_LINK_SECRET` (Production + Preview, separate values), `SUPABASE_SECRET_KEY` (Production, **dev** project). Local folder linked to the Vercel project (`.vercel/`, git-ignored); `vercel link` appends a `VERCEL_OIDC_TOKEN` to `.env.local`, which was removed. Test data on dev (C, fake): customer "Çağlar Öztürk" with several test jobs, photos and visits.

## Uncommitted changes
None. The M4 close-out commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M5.1** 🔑: migration `customer_cancel` with `public_cancel_job(job_id, share_version, reason, note)` (`service_role` only; locks the job, re-checks `share_enabled`/version, J6 cascade, inserts the `customer_cancelled` notification), `POST /api/t/[token]/cancel` (Origin check, zod, rate limit, `link_holder` event) and the CancelSheet on the customer page (reason required, note required for "Diğer", confirmation). Test in PGlite, then **ask before `supabase db push`**; regenerate types; re-run security-check.

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
