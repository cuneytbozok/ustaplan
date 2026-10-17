# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M2.2 is In Progress**: the Yeni iş form works locally (4 interactions for an existing customer, 3 from the customer page). Waiting for push approval (deploy) and the owner's phone check, then M2.2 is closed. Next after that: **M2.3** (İşler list + search).

## Last completed task
**M2.1** (`22362cc`, pushed): `jobs` migration on dev; security-check 98/98.

## Current or interrupted task
**M2.2**: remaining: push (approval). On the phone the owner creates a job for an existing customer via FAB → chip → type → İşi kaydet (≤ 4 interactions), and one with a new inline customer. Then close (PROGRESS, HANDOVER, commit).

## Files changed (M2.2)
`src/actions/jobs.ts`, `src/app/(app)/isler/yeni/page.tsx`, `src/components/jobs/new-job-form.tsx`, `src/components/shell/new-job-fab.tsx`, `src/app/(app)/layout.tsx` (FAB + more bottom padding), `src/app/(app)/musteriler/[id]/page.tsx` ("Yeni iş" button).

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
- **M2.2:** after `create_job`, the action redirects to the customer page. **M2.4 must switch this to `/isler/<job_id>`.** Test data: C has customer "Çağlar Öztürk" with 3 fake jobs (useful for M2.3).
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
None after the M2.2 commit. Not pushed: M2.2.

## Exact next action
Ask for push approval → push → the owner checks M2.2 on the phone → close M2.2. Then, on instruction, **M2.3** İşler: Açık / Tamamlanan / İptal filters + search on title (`jobs.search_key`), customer name and phone (via customers.search_key), status shown with colour + text.

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
