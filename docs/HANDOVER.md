# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M3.2 is Completed**: `scheduling.ts` with Vitest (18/18). Next: **M3.3** (AppointmentPicker + ConflictCard), on the owner's instruction.

## Last completed task
**M3.2**: `src/lib/domain/scheduling.ts` + `tests/scheduling.test.ts`. Before it, M3.1 (`bd3c240`) put `save_appointment`/`close_appointment` on dev.

## Current or interrupted task
None.

## Files changed (M3.2)
`src/lib/domain/scheduling.ts` (new), `tests/scheduling.test.ts` (new), trackers.

## Key decisions
- **M3.2:** scheduling is pure; callers pass the artisan's `scheduled` appointments (plain RLS select, `starts_at < end and ends_at > start`, plus that day and the next for the suggestion). `suggestSlot` takes `now` so tests are deterministic; the next-day fallback also searches until 20:00 and returns null if full. Istanbul conversions go through `TZDate`, so results don't depend on the server's TZ.
- **M3.1 (T-13):** idempotency of `save_appointment` = same job + same times returns the existing (or replacement) appointment; past times allowed; derived J2/J3 status changes write no separate event. Lock order: job, then appointment.
- M2.4: edit = plain RLS update, history via `jobs_log_changes`; status via `change_job_status` + `refresh()`; the complete/cancel confirmation lists scheduled visits with `ends_at > now`.
- `Date.now()` in a Server Component trips the `react-hooks/purity` lint; use helpers in `lib/domain/time.ts` (after `connection()`, which `createClient()` does).
- Earlier lessons still apply: each page wraps its reads in its own `<Suspense>`; render `NotFoundState` inline instead of `notFound()`; every artisan action starts with `actionContext()`.

## Tests executed
`npm test` 18/18 (also under TZ=UTC, America/New_York, Asia/Tokyo); typecheck, lint. M3.1: PGlite 38/38, security-check 105/105.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C): "Kombi bakımı" now unplanned with address Ev, prices 3.000 / 2.750, one cancelled fake appointment; new job "Klima montajı (test)" in progress.

## Uncommitted changes
None. Unpushed to GitHub: the M2.4 close-out, the M3.1 commits and M3.2 (push with the next approved push).

## Exact next action
On "start the next task", do **M3.3**: AppointmentPicker (date chips Bugün / Yarın / Tarih seç, 15-min time, duration chips 30/60/90/120/other) + ConflictCard (clashing job + suggested slot, button "Yine de kaydet") in Yeni iş (the "Randevu planla" switch → `create_job` with times) and İş detayı (add, reschedule via `save_appointment`, complete/cancel a visit via `close_appointment`). Done when a conflict shows a warning, "Yine de kaydet" works, and a job can have several visits.

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
