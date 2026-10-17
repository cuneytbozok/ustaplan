# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M2.4 is Completed, so M2 is complete**: İş detayı works locally and on the owner's phone. Next: **M3.1** 🔑 (appointments migration), on the owner's instruction.

## Last completed task
**M2.4** (`91f77dc`, pushed, Vercel deploy READY): İş detayı, status sheet, reopen, edit, price history, timeline. Owner verified it on the phone (2026-10-18).

## Current or interrupted task
None.

## Files changed (M2.4)
- New: `src/app/(app)/isler/[id]/page.tsx`, `src/app/(app)/isler/[id]/duzenle/page.tsx`, `src/components/jobs/{job-status-sheet,job-timeline,edit-job-form}.tsx`.
- Changed: `src/actions/jobs.ts` (`updateJob`, `changeJobStatus`; `createJob` → `/isler/<id>`), `src/lib/domain/labels.ts` (event + field labels), `money.ts` (`formatPriceInput`), `time.ts` (`hasNotEnded`), İşler and customer-page rows are now links.

## Key decisions
- Edit = plain RLS update of the granted columns; history comes from `jobs_log_changes` (no new RPC). Composite FKs reject a foreign customer or a mismatched address (23503 → friendly message). Changing the customer clears the address choice.
- Status changes go through `change_job_status`; `refresh()` after ok; the sheet closes only after the server confirmed. Closed jobs show a one-tap "İşi yeniden aç" (J5 creates nothing).
- The complete/cancel confirmation lists `scheduled` appointments with `ends_at > now` (same rule as the RPC, T-12). A read-only Randevular list shows only when appointments exist; adding/editing visits is M3.3.
- The artisan's cancel note is private ("Sadece sen görürsün"); it is shown on the job but not in the timeline payload.
- Edit form's no-address option says **"Adres yok"** (clearer when removing an address); the Yeni iş form keeps the owner's "Adres Seç". Ask the owner if they want them identical.
- `Date.now()` in a Server Component trips the `react-hooks/purity` lint; use helpers in `lib/domain/time.ts` (after `connection()`, which `createClient()` does).
- Earlier lessons still apply: each page wraps its reads in its own `<Suspense>`; render `NotFoundState` inline instead of `notFound()`; every artisan action starts with `actionContext()`.

## Tests executed
Local 360 px as C (see PROGRESS M2.4 row), typecheck, lint, `npm run build`, `security-check` 98/98.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C): "Kombi bakımı" now unplanned with address Ev, prices 3.000 / 2.750, one cancelled fake appointment; new job "Klima montajı (test)" in progress.

## Uncommitted changes
None. The M2.4 close-out tracker commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M3.1** 🔑: migration `appointments` with `save_appointment` and `close_appointment` (DATA_MODEL §4, J2/J3), created with `npx supabase migration new appointments`, tested locally (PGlite harness), then **ask the owner before `supabase db push`** to dev. After it's applied: regenerate `src/types/database.ts` and re-run `security-check`.

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
