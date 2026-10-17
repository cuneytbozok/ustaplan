# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M3.5 is In Progress**: Bugün (summary, today's visits, Takip gerekenler with quick actions) works locally. Remaining: push (approval) + phone smoke, then close it (that also completes M3).

## Last completed task
**M3.4** (`fce794d`, `aad8d01`): Takvim + "Geri" back navigation; owner verified both on the phone.

## Current or interrupted task
**M3.5**: committed locally, not pushed.

## Files changed (M3.5)
`src/app/(app)/bugun/page.tsx` (rewritten), `src/components/today/complete-job-quick.tsx` (new), `appointments-section.tsx` (`initialEditing`, scroll, exported `CompleteVisitButton`), `isler/[id]/page.tsx` (`?planla=`), `src/lib/supabase/count.ts` (deleted).

## Key decisions
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
M3.5: local 360 px Bugün flows as C (see PROGRESS), typecheck, lint, test 18/18, build.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C, all fake): Kombi bakımı (unplanned, no visit), Petek temizliği (in progress, ₺1.800, visit 19 Eki 10:00), "Batarya değişimi (test)" (visits 18 Eki 15:00 and 19 Eki 10:00, clashing on purpose), "Klima montajı (test)" (in progress, visit 17 Eki done), "Geri testi (test)" (completed). Customer note "Akşam arayın (test)".

## Uncommitted changes
None. Unpushed: the M3.4 close-out and the M3.5 commit.

## Exact next action
Ask the owner to approve `git push`, then they check Bugün on the phone (today's visit buttons, Takip gerekenler quick actions). On OK, mark M3.5 Completed (**M3 complete**) and commit "M3.5: close task…". Then M4.1 (image preparation + artisan photos) on instruction.

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
