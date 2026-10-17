# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M2.1 is Completed**: the `jobs` migration (`create_job`, `change_job_status`, `jobs_log_changes`) is applied to dev, and the security check passes 98/98. Committed locally, not pushed (no UI change). Next: **M2.2** (Yeni iş form).

## Last completed task
**M2.1** 🔑: `supabase/migrations/20261017214332_jobs.sql`, applied with owner approval. Types regenerated. `security-check.ts` extended with RPC checks.

## Current or interrupted task
None.

## Files changed (M2.1)
`supabase/migrations/20261017214332_jobs.sql`, `src/types/database.ts`, `scripts/security-check.ts`, `docs/architecture/DATA_MODEL.md` (§4/§5 details), `docs/IMPLEMENTATION_PLAN.md` (T-12), `docs/PROGRESS.md`, this file.

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- **Cache Components lessons (M1.6):** client hooks that read the URL (`usePathname`, `useSearchParams`) must render inside `<Suspense>`. Don't call `notFound()` inside streamed content: render `NotFoundState` instead. In browser tests, `innerText` includes the hidden fallback's "Yükleniyor…", so check visually or with element queries.
- **RPC contract (M2.1):** `create_job(p_job_id, …)`: the Server Action generates the job id (`crypto.randomUUID()`) so a double tap is idempotent. Both RPCs return `{result, …}` jsonb (`ok · customer_not_found · invalid_input` / `ok · not_found · invalid_transition · invalid_input`); table checks and FKs still raise errors (e.g. a bad address → 23503), so map those in the action. `share_version` can only go up.
- PGlite harness for migrations: `scratchpad/pgl/run-jobs.mjs` (not committed). Recreate it with stub `auth`/`storage` + roles if the scratchpad is gone.
- Every new artisan Server Action starts with `actionContext()` (`lib/auth-action.ts`). `settings.ts` predates it and has its own inline `getClaims`.
- **Deferrals (no dead buttons):** the `+ Yeni iş` FAB arrives with the Yeni iş form (M2.2), the bell with the inbox (M5.4). The Ayarlar entry was added in M1.5.
- M1.5: forms use `useActionState` plus `FormField`/`FormStatus` (`components/common`). Success is shown only from the server's result. Password fields reset after each submit. B's test password was changed in M1.5; the current value is in `.env.local`.
- Tab pages show real owner-scoped counts (`countOrThrow`) until their list tasks (M1.6, M2.3, M3.x) replace them. Each page keeps its reads in its own `<Suspense>`.

## Tests executed
M1.4: helper scratch run, local 360 px tab/sheet/logout run, the A/B count isolation probe, typecheck, lint, env-free build, owner's phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- Supabase advisor: leaked-password protection off (owner decision before the pilot).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None after the M2.1 commit. Local only: M2.1 (pushing redeploys; no UI change). M1.6 close-out and M1.7 were pushed (`e9fc6c1`).

## Exact next action
On "start the next task", do **M2.2** Yeni iş (`/isler/yeni`): recent-customer chips, inline new customer (name + optional phone), "Yapılacak iş" (customer-visible, labelled), "Diğer detaylar" (address from the customer's addresses, estimated + agreed price via `parseTurkishPrice`, "Anlaşılan fiyatı müşteri görsün", private note "Sadece sen görürsün"). Calls `create_job` with a generated id. Add the `+ Yeni iş` FAB to the shell now that the form exists. Done when: a job for an existing customer takes ≤ 4 interactions on the phone. (Scheduling the first appointment is M3; don't build the picker yet.)

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
