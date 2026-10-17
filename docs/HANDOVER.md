# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M2.3 is In Progress**: the İşler list with filters and search is verified locally. Waiting for push approval (deploy) and the owner's phone smoke, then M2.3 is closed. Next after that: **M2.4** (İş detayı).

## Last completed task
**M2.2** (`ee90f49`, pushed; label tweak in the close-out commit): Yeni iş with recent-customer chips, inline customer, Diğer detaylar, idempotent `create_job`, FAB on the tab pages. Owner-requested label: the no-address radio reads **"Adres Seç"** (it means no address chosen for the job).

## Current or interrupted task
**M2.3**: remaining: push (approval; it also carries the M2.2 "Adres Seç" label). On the phone the owner switches Açık/Tamamlanan/İptal and searches by title, customer and phone. Then close (PROGRESS, HANDOVER, commit).

## Files changed (M2.3)
`src/app/(app)/isler/page.tsx`, `src/components/jobs/job-status-badge.tsx`, `src/components/common/search-box.tsx` (was `customers/customer-search.tsx`), `src/lib/search.ts`, `src/app/(app)/musteriler/page.tsx` + `[id]/page.tsx` (shared search + badge).

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- **Cache Components lessons (M1.6):** client hooks that read the URL (`usePathname`, `useSearchParams`) must render inside `<Suspense>`. Don't call `notFound()` inside streamed content: render `NotFoundState` instead. In browser tests, `innerText` includes the hidden fallback's "Yükleniyor…", so check visually or with element queries.
- **RPC contract (M2.1):** `create_job(p_job_id, …)`: the Server Action generates the job id (`crypto.randomUUID()`) so a double tap is idempotent. Both RPCs return `{result, …}` jsonb (`ok · customer_not_found · invalid_input` / `ok · not_found · invalid_transition · invalid_input`); table checks and FKs still raise errors (e.g. a bad address → 23503), so map those in the action. `share_version` can only go up.
- PGlite harness for migrations: `scratchpad/pgl/run-jobs.mjs` (not committed). Recreate it with stub `auth`/`storage` + roles if the scratchpad is gone.
- Every new artisan Server Action starts with `actionContext()` (`lib/auth-action.ts`). `settings.ts` predates it and has its own inline `getClaims`.
- **Deferrals (no dead buttons):** the bell arrives with the inbox (M5.4). The Ayarlar entry came in M1.5, the FAB in M2.2.
- **M2.2:** after `create_job`, the action redirects to the customer page. **M2.4 must switch this to `/isler/<job_id>`.** Test data: C has customer "Çağlar Öztürk" with 3 fake jobs: Kombi bakımı (completed), Vana değişimi (cancelled), Petek temizliği (in progress).
- **Browser-test tip:** streamed Suspense content sits outside `<main>` in fetched HTML (React moves it in on the client). Query `ul li …` rather than `main …` when parsing.
- Browser-pane oddity: the tab twice jumped to `/bugun` mid-test with no app request causing it (the dev "N" badge sits on the Bugün tab). Re-navigate and continue.
- M1.5: forms use `useActionState` plus `FormField`/`FormStatus` (`components/common`). Success is shown only from the server's result. Password fields reset after each submit. B's test password was changed in M1.5; the current value is in `.env.local`.
- Tab pages show real owner-scoped counts (`countOrThrow`) until their list tasks (M1.6, M2.3, M3.x) replace them. Each page keeps its reads in its own `<Suspense>`.

## Tests executed
M1.4: helper scratch run, local 360 px tab/sheet/logout run, the A/B count isolation probe, typecheck, lint, env-free build, owner's phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None after the M2.3 commit. Not pushed: M2.2 close-out ("Adres Seç") + M2.3.

## Exact next action
Ask for push approval → push → the owner smoke-tests İşler on the phone → close M2.3. Then, on instruction, **M2.4** İş detayı (`/isler/[id]`): edit (title, address, prices, show-price, private note, customer), price block + history from `job_events`, status sheet (`change_job_status`: start, wait_material, complete with confirmation listing the future appointments, cancel with optional note, reopen), timeline. Make the İşler rows and the customer-page job rows link to it, and switch the `createJob` redirect to `/isler/<id>`. Done when: all transitions behave per §7 and price edits appear in the history.

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
