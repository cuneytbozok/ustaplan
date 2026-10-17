# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M3.4 is In Progress**: Takvim was verified on the owner's phone; the back-navigation fix the owner asked for works locally. Remaining: push (approval) + phone check, then close it.

## Last completed task
**M3.3** (`73cce70`): appointment picker, conflict card, visit actions.

## Current or interrupted task
**M3.4**: Takvim (`fce794d`, pushed, owner OK) + "Geri" fix (committed locally, not pushed).

## Files changed (M3.4)
`src/app/(app)/takvim/page.tsx`, `scheduling.ts` (`istanbulToday`). Back fix: `components/shell/navigation-marker.tsx` (new: marker, `canGoBack`, `useGoBack`), `components/common/back-link.tsx` ("Geri", no label prop), `(app)/layout.tsx`, all `BackLink` call sites, `actions/{jobs,customers,auth}.ts` (replace redirects; `updateJob`/`updateCustomer` return ok), `edit-job-form.tsx`, `customer-form.tsx`, both edit pages (`doneHref`).

## Key decisions
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
M3.4: local 360 px Takvim flows and back-navigation flows as C (see PROGRESS), typecheck, lint, build.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review open; blocks only M6.3.
- Test data on dev (C): Kombi bakımı (unplanned; visits: one completed, two cancelled), Petek temizliği (in progress, visit 19 Eki 10:00), "Batarya değişimi (test)" (scheduled, 19 Eki 10:00, clashes on purpose), "Klima montajı (test)" (in progress).

## Uncommitted changes
None. Unpushed: the back-navigation fix commit.

## Exact next action
Ask the owner to approve `git push`, then they check "Geri" on the phone (Takvim → job → Geri; customer → job → Geri; edit → save → Geri). On OK, mark M3.4 Completed and commit "M3.4: close task…". Then M3.5 (Bugün) on instruction.

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
