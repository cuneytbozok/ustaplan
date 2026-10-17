# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.1 is Completed**: the `core` schema is applied to Supabase dev and the types are generated. Commits are local (M0.4 + M1.1), and **pushing needs owner approval** (a push deploys). Next: **M1.2** 🔑 (admin scripts + fake artisans A/B).

## Last completed task
**M1.1** 🔑: `supabase/migrations/20261017203619_core.sql` (DATA_MODEL §2, §3, §5 `touch_updated_at`, §6). The owner approved `db push`; it applied cleanly. `src/types/database.ts` was regenerated.

## Current or interrupted task
None.

## Files changed
`supabase/migrations/20261017203619_core.sql` (new), `src/types/database.ts` (generated), `CLAUDE.md`, `docs/architecture/DATA_MODEL.md`, `docs/PROGRESS.md`, this file.

## Key decisions
- **`share_enabled`/`share_version`**: CLAUDE.md said RPC-only, while DATA_MODEL §3 grants them as plain updates (and there's no RPC for them among the 9). I followed §3 and corrected CLAUDE.md and the §2 labels. The M2.1 `jobs_log_changes` trigger logs these changes.
- The migration revokes `anon` from public-schema default privileges. **Every future function must `revoke execute … from public, anon`** (now documented in DATA_MODEL §3).
- Added `default auth.uid()` on `owner_user_id` for directly inserted tables (customers, addresses, job_media, push_subscriptions). RLS still enforces ownership.
- Extra checks implied by DATA_MODEL text: appointments `closed_at` ⇔ not scheduled, and `replaced_by_id` only when superseded; requests `resolved_at` ⇔ terminal and `resulting_appointment_id` ⇔ accepted; media `deleted_at` ⇔ `deleted_by`, plus the duration rule. M3.1 and M5.3 RPCs must satisfy them.
- CLI on this Mac: `supabase db push` and `db query --linked` work via the access token (no DB password needed). `npx supabase db advisors --linked` is a free extra check.
- Pre-push SQL testing: a PGlite harness lives in the scratchpad only (not committed). Recreate it if needed: `@electric-sql/pglite` with stub `auth`/`storage` schemas and roles.

## Tests executed
PGlite 41/41. Live: `migration list` in sync; catalog checks (RLS, grants, buckets, policy counts); anon REST 42501; advisors clean. `npm run typecheck` and `lint` pass. `scripts/security-check.ts` doesn't exist yet (M1.7).

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None. `main` is ahead of `origin` by 2 commits (M0.4 trackers, M1.1). The owner asked to push them together after M1.1 → ask for approval.

## Exact next action
On "start the next task", do **M1.2** 🔑: `npm i -D tsx`. Write `scripts/create-artisan.ts --email --name` (auth admin `createUser` with `email_confirm: true` plus a `profiles` row, roll back the user on failure, print a generated temp password once) and `scripts/reset-password.ts --email`, using `adminEnv()` (needs `SUPABASE_SECRET_KEY` in `.env.local`; the owner pastes it, it's never shown in chat). Ask approval, then create fake artisans A and B in dev.

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git log --oneline -15
```
```bash
npx supabase migration list
```
