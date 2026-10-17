# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M4.1 is In Progress**: artisan photos (prepare → upload → register, share, delete, grid + viewer, customer page) work locally. Remaining: push (approval) + an iPhone HEIC upload from the owner's phone, then close it.

## Last completed task
**M3.5** (`32bd86e`): Bugün; owner verified it on the phone (**M3 complete**).

## Current or interrupted task
**M4.1**: committed locally, not pushed.

## Files changed (M4.1)
New: `src/lib/media/{prepare-image,photos}.ts`, `src/lib/supabase/browser.ts`, `src/actions/media.ts`, `src/components/media/photo-gallery.tsx`. Changed: `isler/[id]/page.tsx` (Fotoğraflar section), `musteriler/[id]/page.tsx` (photos of all jobs), `package.json`/lock (`heic2any` 0.0.4 exact).

## Key decisions
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
M4.1: local 360 px upload/share/delete flows with a GPS-tagged JPEG and a HEIC (stored files inspected with PIL), security-check 105/105, typecheck, lint, build.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C, all fake): Kombi bakımı (unplanned, no visit), Petek temizliği (in progress, ₺1.800, visit 19 Eki 10:00), "Batarya değişimi (test)" (visits 18 Eki 15:00 and 19 Eki 10:00, clashing on purpose), "Klima montajı (test)" (in progress, visit 17 Eki done), "Geri testi (test)" (completed). Customer note "Akşam arayın (test)".

## Uncommitted changes
None. Unpushed: the M3.5 close-out and the M4.1 commit.

## Exact next action
Ask the owner to approve `git push`, then they upload an iPhone photo (HEIC) on a job, check it appears, toggle "Müşteriyle paylaş" and delete one. Optionally check the stored size/EXIF with the admin client. On OK, mark M4.1 Completed and commit "M4.1: close task…". Then M4.2 (voice notes) on instruction.

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
