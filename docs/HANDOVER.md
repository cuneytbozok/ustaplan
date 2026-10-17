# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M2.4 is In Progress**: İş detayı works locally (all §7 manual transitions, edit, price history, timeline). Remaining: push (owner approval) + phone smoke, then close it.

## Last completed task
**M2.3** (`1858820`): İşler list with filters and search; owner verified on the iPhone.

## Current or interrupted task
**M2.4** İş detayı — code committed locally, not pushed. Waiting for the owner to approve the push and check it on the phone.

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
None after the M2.4 commit. Unpushed: the M2.3 close-out commit and the M2.4 commit.

## Exact next action
Ask the owner to approve `git push` (Vercel deploy), then they check `/isler/<id>` on the phone: open a job from İşler, change status, complete/cancel/reopen, edit a price and see it in Fiyat geçmişi. On OK, mark M2.4 Completed (PROGRESS + log row + this file), commit "M2.4: close task…". Then M3.1 🔑 on instruction.

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
