# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.2 is Completed** (committed locally, not pushed): admin scripts exist, and fake artisans A and B exist in Supabase dev. Next: **M1.3** (Supabase clients, `proxy.ts`, `(app)` guard, `/giris`, logout).

## Last completed task
**M1.2** 🔑: `npm run admin:create-artisan -- --email … --name …` and `npm run admin:reset-password -- --email …`. Both print a generated temporary password once. Create rolls back the auth user if the profile insert fails.

## Current or interrupted task
None.

## Files changed
`scripts/{create-artisan,reset-password,admin-shared}.ts`, `src/lib/supabase/admin.ts` (secret-key client, `server-only`), `package.json`/lock (`@supabase/supabase-js`, dev `tsx`, `admin:*` scripts), `.env.example`, `README.md`, `docs/PROGRESS.md`, this file.

## Key decisions
- Scripts run with `tsx --env-file-if-exists=.env.local --conditions=react-server`. The condition lets them import the `server-only` modules (`lib/env.ts`, `lib/supabase/admin.ts`). tsx compiles `.ts` as CJS, so scripts use `async function main()` rather than top-level await.
- `npx supabase projects api-keys` **masks secret keys unless `--reveal`** is passed. The key was piped into `.env.local` with `--reveal`, never echoed.
- The test artisans' credentials live only in `.env.local` as `TEST_ARTISAN_{A,B}_{EMAIL,PASSWORD}` (names in `.env.example`) for `security-check.ts` (M1.7) and for login checks in M1.3. Never print them.
- zsh in this environment doesn't word-split variables; use shell functions, not `$CMD` strings.
- Dev users: A `usta-a@ustaplan.test` (c16bd787-…), B `usta-b@ustaplan.test` (a7531534-…).

## Tests executed
Rollback (forced profile 500) → no user left. A and B sign in via the publishable key and see only their own profile (live RLS). Reset: old password `invalid_credentials`, new one OK. Duplicate and unknown email refused. `npm run typecheck` and `lint` pass.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None. The M1.2 commit is local; **pushing needs owner approval** (a push deploys; nothing user-visible changes).

## Exact next action
On "start the next task", do **M1.3**. Read `node_modules/next/dist/docs` (proxy, authentication, `authentication-with-cache-components` since `cacheComponents` is on) and the current `@supabase/ssr` docs first. Then build `lib/supabase/{server,browser}.ts`, `src/proxy.ts` (refresh session; skip `/t`, `/api/t`, `/api/internal`, `/gizlilik`, static assets), the `(app)` layout guard using `getClaims()`/`getUser()`, `/giris` (email, password show/hide, fixed forgot-password sentence) and logout. Verify login with A and B locally and on the phone (needs a push).

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
