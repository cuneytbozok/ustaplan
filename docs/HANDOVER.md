# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M3.1 is Completed**: `save_appointment` and `close_appointment` are live on dev and verified. Next: **M3.2** (`scheduling.ts` + Vitest), on the owner's instruction.

## Last completed task
**M3.1** 🔑: migration `20261017230457_appointments.sql` applied to dev with approval; types regenerated; security-check extended (105/105); live J2/J3 smoke as A.

## Current or interrupted task
None.

## Files changed (M3.1)
The migration; `src/types/database.ts`; `scripts/security-check.ts` (Appointment RPCs section); `docs/architecture/DATA_MODEL.md` (RPC results), `docs/IMPLEMENTATION_PLAN.md` (T-13); `src/components/jobs/edit-job-form.tsx` ("Adres Seç", owner request); `src/components/jobs/job-timeline.tsx` (`link_holder` actor fix).

## Key decisions
- **M3.1 (T-13):** idempotency of `save_appointment` = same job + same times returns the existing (or replacement) appointment; past times allowed; derived J2/J3 status changes write no separate event. Lock order: job, then appointment.
- M2.4: edit = plain RLS update, history via `jobs_log_changes`; status via `change_job_status` + `refresh()`; the complete/cancel confirmation lists scheduled visits with `ends_at > now`.
- `Date.now()` in a Server Component trips the `react-hooks/purity` lint; use helpers in `lib/domain/time.ts` (after `connection()`, which `createClient()` does).
- Earlier lessons still apply: each page wraps its reads in its own `<Suspense>`; render `NotFoundState` inline instead of `notFound()`; every artisan action starts with `actionContext()`.

## Tests executed
PGlite 38/38 (`scratchpad/pgl/run-appts.mjs`, not committed; args = core, jobs, appointments SQL); security-check 105/105; live smoke on dev; typecheck, lint.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C): "Kombi bakımı" now unplanned with address Ev, prices 3.000 / 2.750, one cancelled fake appointment; new job "Klima montajı (test)" in progress.

## Uncommitted changes
None. Unpushed to GitHub: the M2.4 close-out and both M3.1 commits (the app code is unchanged apart from the two small UI fixes; push with the next approved push).

## Exact next action
On "start the next task", do **M3.2**: `src/lib/domain/scheduling.ts` (overlap test with back-to-back allowed, suggested slot = first free gap of the same length 08:00–20:00 that day, else next day from 09:00, Istanbul time, 15-min steps, duration 15–480) + Vitest tests (`scheduling.test.ts`). Done when the tests pass.

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
