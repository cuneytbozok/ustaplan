# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M3.3 is Completed**: the appointment picker, conflict card and visit actions work locally and on the owner's phone. Next: **M3.4** (Takvim day/week), on the owner's instruction.

## Last completed task
**M3.3** (`73cce70`, pushed, Vercel deploy READY). Owner verified it on the phone (2026-10-18).

## Current or interrupted task
None.

## Files changed (M3.3)
New: `src/actions/appointments.ts` (`checkSchedule`, `saveAppointment`, `closeAppointment`), `src/components/appointments/{appointment-picker,appointments-section}.tsx`. Changed: `scheduling.ts` (`TIME_OPTIONS`, `pickerDefaults`, `readAppointmentFields`), `actions/jobs.ts` (createJob takes the first visit), `new-job-form.tsx` + `isler/yeni/page.tsx` ("Randevu planla"), `isler/[id]/page.tsx` (AppointmentsSection), `job-timeline.tsx` + `labels.ts` (visit events), `confirm-action.tsx` (`pendingLabel`).

## Key decisions
- **M3.3:** the picker posts Istanbul date/time/duration; the server converts (never trust the client's TZ). The conflict check is a read-only Server Action; it never blocks saving. Helpers that aren't actions live in `lib/` (every export of a `"use server"` file becomes an endpoint). Superseded visits are hidden in the UI; the history keeps the reschedule. The parent's `onConflictChange` is kept in a ref synced in an effect (the `react-hooks/refs` lint forbids writing refs during render).
- **M3.2:** scheduling is pure; callers pass the artisan's `scheduled` appointments (plain RLS select, `starts_at < end and ends_at > start`, plus that day and the next for the suggestion). `suggestSlot` takes `now` so tests are deterministic; the next-day fallback also searches until 20:00 and returns null if full. Istanbul conversions go through `TZDate`, so results don't depend on the server's TZ.
- **M3.1 (T-13):** idempotency of `save_appointment` = same job + same times returns the existing (or replacement) appointment; past times allowed; derived J2/J3 status changes write no separate event. Lock order: job, then appointment.
- M2.4: edit = plain RLS update, history via `jobs_log_changes`; status via `change_job_status` + `refresh()`; the complete/cancel confirmation lists scheduled visits with `ends_at > now`.
- `Date.now()` in a Server Component trips the `react-hooks/purity` lint; use helpers in `lib/domain/time.ts` (after `connection()`, which `createClient()` does).
- Earlier lessons still apply: each page wraps its reads in its own `<Suspense>`; render `NotFoundState` inline instead of `notFound()`; every artisan action starts with `actionContext()`.

## Tests executed
M3.3: local 360 px flows as C (see PROGRESS), typecheck, lint, `npm test` 18/18, `npm run build`.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C): Kombi bakımı (unplanned; visits: one completed, two cancelled), Petek temizliği (in progress, visit 19 Eki 10:00), "Batarya değişimi (test)" (scheduled, 19 Eki 10:00, clashes on purpose), "Klima montajı (test)" (in progress).

## Uncommitted changes
None. The M3.3 close-out tracker commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M3.4** Takvim (`/takvim`): day and week views of scheduled visits (Istanbul days via `istanbulDayRange`/`istanbulWeekRange`), each linking to its job, with conflict markers (use `overlaps` from `scheduling.ts`), previous/next and "Bugün" navigation, skeleton/empty/error states. Done when it passes a smoke test.

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
