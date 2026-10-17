# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M3.1 is In Progress**: the `appointments` migration is written and passes PGlite 38/38. It's waiting for the owner's approval to `supabase db push` to dev.

## Last completed task
**M2.4** (`91f77dc`, pushed): İş detayı. Owner verified it on the phone (M2 complete).

## Current or interrupted task
**M3.1** 🔑: `supabase/migrations/20261017230457_appointments.sql` (`save_appointment`, `close_appointment`), not applied anywhere yet. Harness: `scratchpad/pgl/run-appts.mjs` in this session's scratchpad (not committed); args = core, jobs, appointments SQL.

## Files changed (M3.1 so far)
The migration; `docs/architecture/DATA_MODEL.md` (RPC results), `docs/IMPLEMENTATION_PLAN.md` (T-13); `src/components/jobs/edit-job-form.tsx` ("Adres Seç", owner request); `src/components/jobs/job-timeline.tsx` (`link_holder` actor fix).

## Key decisions
- **M3.1 (T-13):** idempotency of `save_appointment` = same job + same times returns the existing (or replacement) appointment; past times allowed; derived J2/J3 status changes write no separate event. Lock order: job, then appointment.
- M2.4: edit = plain RLS update, history via `jobs_log_changes`; status via `change_job_status` + `refresh()`; the complete/cancel confirmation lists scheduled visits with `ends_at > now`.
- `Date.now()` in a Server Component trips the `react-hooks/purity` lint; use helpers in `lib/domain/time.ts` (after `connection()`, which `createClient()` does).
- Earlier lessons still apply: each page wraps its reads in its own `<Suspense>`; render `NotFoundState` inline instead of `notFound()`; every artisan action starts with `actionContext()`.

## Tests executed
PGlite 38/38 for the appointments migration; typecheck, lint.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C): "Kombi bakımı" now unplanned with address Ev, prices 3.000 / 2.750, one cancelled fake appointment; new job "Klima montajı (test)" in progress.

## Uncommitted changes
None after the M3.1 WIP commit. Unpushed: the M2.4 close-out and the M3.1 WIP commits.

## Exact next action
With the owner's approval: `npx supabase db push` (dev), `npx supabase gen types typescript --linked > src/types/database.ts`, `npm run security-check` (extend it with appointment RPC cross-user checks), quick live smoke of J2/J3 as C via RPC, then mark M3.1 Completed and commit. Then M3.2 on instruction.

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
