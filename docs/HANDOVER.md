# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**Milestone M1 is complete** (M1.7 done: `npm run security-check` 89/89 PASS against dev). Commits are local (M1.6 close-out + M1.7); pushing needs approval. Next: **M2.1** 🔑 (migration `jobs`: `create_job`, `change_job_status`, `jobs_log_changes`), on the owner's instruction.

## Last completed task
**M1.7**: `scripts/security-check.ts` v1 (RLS isolation for every table, anon denial, storage isolation, workflow-column denial), with positive read and write controls. It creates tagged fixtures with the admin client and removes them in `finally`.

## Current or interrupted task
None.

## Files changed (M1.7)
`scripts/security-check.ts` (new), `package.json` (`security-check` script), `README.md`, `docs/PROGRESS.md`, this file.

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- **Cache Components lessons (M1.6):** client hooks that read the URL (`usePathname`, `useSearchParams`) must render inside `<Suspense>`. Don't call `notFound()` inside streamed content: render `NotFoundState` instead. In browser tests, `innerText` includes the hidden fallback's "Yükleniyor…", so check visually or with element queries.
- Every new artisan Server Action starts with `actionContext()` (`lib/auth-action.ts`). `settings.ts` predates it and has its own inline `getClaims`.
- **Deferrals (no dead buttons):** the `+ Yeni iş` FAB arrives with the Yeni iş form (M2.2), the bell with the inbox (M5.4). The Ayarlar entry was added in M1.5.
- M1.5: forms use `useActionState` plus `FormField`/`FormStatus` (`components/common`). Success is shown only from the server's result. Password fields reset after each submit. B's test password was changed in M1.5; the current value is in `.env.local`.
- Tab pages show real owner-scoped counts (`countOrThrow`) until their list tasks (M1.6, M2.3, M3.x) replace them. Each page keeps its reads in its own `<Suspense>`.

## Tests executed
M1.4: helper scratch run, local 360 px tab/sheet/logout run, the A/B count isolation probe, typecheck, lint, env-free build, owner's phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None after the M1.7 commit. Not pushed: M1.6 close-out + M1.7 (a push redeploys; no UI change).

## Exact next action
On "start the next task", do **M2.1** 🔑: `npx supabase migration new jobs`, then hand-write `create_job` (optional inline customer + job + optional first appointment), `change_job_status` (rules J1–J6 in plan §7) and the `jobs_log_changes` trigger (price/visibility/share/title/address events) per DATA_MODEL §4–§5. All are `security definer` with `set search_path = ''`, assert `auth.uid()`, lock the job row, are idempotent, and `revoke execute … from public, anon` + `grant … to authenticated`. Test in a PGlite dry run first, **ask approval before `db push`**, regenerate types, then **re-run `npm run security-check`** (extend it if the new RPCs need cross-user checks, e.g. B calling `change_job_status` on A's job).

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
