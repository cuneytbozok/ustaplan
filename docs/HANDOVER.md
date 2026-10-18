# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M4.5 is Completed** (security-check v2: 148/148 against a production build). **M4.3 + M4.4** are done locally and wait for: `SHARE_LINK_SECRET` in Vercel (owner approval), push/deploy, and the second-phone check. Then M4 is complete.

## Last completed task
**M4.5**: customer-link, exposure, read-only and media-proxy checks in `scripts/security-check.ts`.

## Current or interrupted task
M4.3 + M4.4: code done and committed (`ade1965`, `c198e9d`); only external steps remain.

## Files changed (M4.3–M4.4, committed `ade1965`, `c198e9d`)
`lib/share-link.ts`, `lib/public-job.ts`, `lib/customer-link.ts`, `app/t/[token]/page.tsx`, `app/t/gecersiz/page.tsx`, `app/t/not-found.tsx`, `app/api/t/[token]/media/[mediaId]/route.ts`, `proxy.ts` (token gate), `next.config.ts` (headers), `components/public/invalid-link.tsx`, `components/jobs/share-sheet.tsx`, `actions/share.ts`, `app/gizlilik/page.tsx`, `lib/domain/links.ts` (`shareMessage`), tests `share-link`, `public-dto`; `.claude/launch.json` (`prod-local` on 3100).

## Key decisions
- **M4.5:** run the security check with a production server: `npm run build && npm run start` (port 3000), then `npm run security-check`. `next dev` puts debug output in error pages, so the identical-404 check only holds on a production build.
- **M4.3:** real 404s for invalid links come from `proxy.ts` (streamed pages can't change status); it rewrites to static `/t/gecersiz` whose `notFound()` makes it a prerendered 404. Verified on a local production build only (`npm run start -- -p 3100`); dev mode differs.
- **M4.2:** the recorder's own timer is the duration source (clamped 1–60 server-side); MP4 is preferred whenever supported so iPhone and most Chrome builds record the same container. Upload content types are the base MIME (`audio/mp4`, `audio/webm`, `audio/ogg`) because the bucket allowlist has no codec parameters. Browser tests: replace `navigator.mediaDevices.getUserMedia` with a Web Audio oscillator stream.
- **M4.1:** the client never chooses the stored path for registration: `registerPhoto(jobId, mediaId)` rebuilds `<uid>/<job>/<media>.jpg`. Every prepared image is JPEG, so the server only accepts JPEG magic bytes for artisan uploads. Artisan photo uploads write no `job_events` (events are RPC/trigger-only); customer photos (M5.2) will. Test images can be generated with PIL (GPS EXIF) and `sips -s format heic` and served temporarily from `public/` (removed afterwards).
- **M3.5:** "Takip gerekenler" = open jobs whose scheduled visits are all ended (overdue) or that have none; computed from one query (open jobs + embedded scheduled appointments). Quick "Yeniden planla"/"Randevu planla" link to the job with `?planla=` rather than duplicating the picker on Bugün. A delayed `scrollIntoView` is needed because the router scrolls to top after mount.
- **Back navigation (M3.4, owner feedback):** "Geri" uses browser history only when this tab has navigated inside the app; otherwise the parent href. Every Server Action redirect uses `RedirectType.replace`; edit forms go back after `ok` (their actions call `refresh()` first, and the restored page showed fresh data). New pages with forms should follow the same pattern.
- Note for browser tests: Next keeps earlier pages mounted but hidden, so `find`/DOM queries can return elements from hidden pages; filter by visibility.
- **M3.4:** calendar state lives in the URL (`gorunum`, `tarih`), links use `replace`. Only `scheduled` visits are shown. Week rows group by the visit's Istanbul start day. Free gaps are computed in the page (display only), not in `scheduling.ts`.
- **M3.3:** the picker posts Istanbul date/time/duration; the server converts (never trust the client's TZ). The conflict check is a read-only Server Action; it never blocks saving. Helpers that aren't actions live in `lib/` (every export of a `"use server"` file becomes an endpoint). Superseded visits are hidden in the UI; the history keeps the reschedule. The parent's `onConflictChange` is kept in a ref synced in an effect (the `react-hooks/refs` lint forbids writing refs during render).
- **M3.2:** scheduling is pure; callers pass the artisan's `scheduled` appointments (plain RLS select, `starts_at < end and ends_at > start`, plus that day and the next for the suggestion). `suggestSlot` takes `now` so tests are deterministic; the next-day fallback also searches until 20:00 and returns null if full. Istanbul conversions go through `TZDate`, so results don't depend on the server's TZ.
- **M3.1 (T-13):** idempotency of `save_appointment` = same job + same times returns the existing (or replacement) appointment; past times allowed; derived J2/J3 status changes write no separate event. Lock order: job, then appointment.
- M2.4: edit = plain RLS update, history via `jobs_log_changes`; status via `change_job_status` + `refresh()`; the complete/cancel confirmation lists scheduled visits with `ends_at > now`.
- `Date.now()` in a Server Component trips the `react-hooks/purity` lint; use helpers in `lib/domain/time.ts` (after `connection()`, which `createClient()` does).
- Earlier lessons still apply: each page wraps its reads in its own `<Suspense>`; render `NotFoundState` inline instead of `notFound()`; every artisan action starts with `actionContext()`.

## Tests executed
`npm test` 30/30; security-check 148/148 against `npm run start` (147/148 against `next dev`, see Key decisions); milestone `npm run build`; local 360 px flows for M4.3/M4.4 (see PROGRESS).

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C, all fake): Kombi bakımı (unplanned, no visit), Petek temizliği (in progress, ₺1.800, visit 19 Eki 10:00), "Batarya değişimi (test)" (visits 18 Eki 15:00 and 19 Eki 10:00, clashing on purpose), "Klima montajı (test)" (in progress, visit 17 Eki done), "Geri testi (test)" (completed). Customer note "Akşam arayın (test)".

## Uncommitted changes
None. Unpushed: everything since `49d01db` (M4.2 close-out, M4.3, M4.4, M4.5, handovers).

## Exact next action
1. Owner approval: add `SHARE_LINK_SECRET` (new random value, ≥ 32 chars, different from the local one) to the Vercel project, Production + Preview, then `git push` (deploy).
2. Owner phone check: on a job, "Müşteriyle paylaş" → WhatsApp → open the link on a second phone; regenerate → the old link shows "Bu bağlantı geçersiz veya kapatılmış."; check `/gizlilik` from the page footer.
3. On OK: mark M4.3 and M4.4 Completed (**M4 complete**), commit. Then M5.1 🔑 on instruction.

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git log --oneline -15
```
```bash
npm ci && npm run typecheck && npm run lint
```
