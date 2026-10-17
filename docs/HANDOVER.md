# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M0.3 is Completed** (committed locally, not pushed). Supabase dev project `xytwwudbnykackuxfeif` (Ireland) is linked, signup is off, and `.env.local` has the URL and publishable key. Next: **M0.4** 🔑 (Vercel), on the owner's instruction.

## Last completed task
**M0.3** 🔑: the owner created the dev project. A first attempt landed in Sydney and was deleted; the second is in **Ireland `eu-west-1`**, which the owner accepted for fake-data dev (plan **T-10**; prod stays Frankfurt). The owner ran `supabase login` and turned signup off in the dashboard. I ran `supabase link`, filled `.env.local` and verified.

## Current or interrupted task
None.

## Files changed
`package.json`/lock (`supabase` CLI dev dep), `supabase/config.toml` + `supabase/.gitignore` (from `supabase init`; `project_id = "ustaplan"`, `enable_signup = false`; the file only describes the unused local stack, so never `config push` it), `docs/IMPLEMENTATION_PLAN.md` (T-10, §11.1, M0.3 row), `docs/setup/05_SETUP_CHECKLIST.md`, `docs/PROGRESS.md`, this file. `.env.local` is local and git-ignored.

## Key decisions
- Dev in Ireland (T-10). At M0.4, set the Vercel function region near it (`dub1`) and check the current Vercel docs.
- The CLI on this Mac is logged in as the owner. `supabase link` needed no DB password prompt (it worked via the access token). `db push` may still ask for the DB password; the owner keeps it.
- The dev project is alone in its Supabase organisation, so the Free limit of two projects per org leaves room for prod at M6.3, if prod goes into the same org.
- Keys are read without printing secrets (only the publishable key is fetched, filtered by type).

## Tests executed
`supabase link` OK. `GET /auth/v1/settings` → `disable_signup: true`. `POST /auth/v1/signup` → 422 `signup_disabled`. The env getters read `.env.local`. `npm run typecheck` and `lint` pass.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted, see M0.2).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None. Local `main` is ahead of `origin` by the M0.2 handover-note commit and the M0.3 commit; **pushing needs owner approval**.

## Exact next action
On "start the next task", do **M0.4** 🔑: connect the Vercel project to GitHub `cuneytbozok/ustaplan` (owner, or connector with approval). Set Production env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `APP_BASE_URL` = the vercel.app URL. Set the function region near Ireland. Push with approval, which deploys. Open the URL on the phone. Run `npm run build` before the push.

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
