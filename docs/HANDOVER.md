# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**Milestone M0 is complete.** The branded placeholder is live at **https://ustaplan.vercel.app** (it opens on the owner's phone), Supabase dev is linked and signup is off. Next: **M1.1** 🔑 (migration `core`), on the owner's instruction.

## Last completed task
**M0.4** 🔑: the owner created Vercel project `ustaplan` (team scope `cuneyts-projects-ec980692`) and connected GitHub `main`. The first build failed because the framework preset wasn't Next.js (Vercel looked for `public/`); setting the Next.js preset fixed it. Production env vars, plain (not sensitive): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL=https://ustaplan.vercel.app`.

## Current or interrupted task
None.

## Files changed
`docs/PROGRESS.md`, this file (no code changes in M0.4).

## Key decisions
- Vercel Function Region = **Dublin (`dub1`)**, near the Ireland DB (set by the owner).
- A push to `main` now **deploys to production**. Every push needs owner approval.
- Secret env vars added later (`SUPABASE_SECRET_KEY` in M1.2 and so on) must be marked **Sensitive** in Vercel, Production only.
- The Vercel MCP connector returns 403 for this team scope, so verify deploys by `curl` on the URL, or ask the owner.

## Tests executed
`npm run build` (no env) passed before the deploy. `curl https://ustaplan.vercel.app` → 200 with `lang=tr`, title, noindex, theme-color; `/icon.svg` 200. The owner confirmed it opens on the phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None. The M0.4 tracker commit is local; pushing it needs approval and **triggers a deploy**. The site's content wouldn't change.

## Exact next action
On "start the next task", do **M1.1** 🔑: `npx supabase migration new core`, then hand-write all tables, checks, `fold_tr`, search keys, `touch_updated_at`, grants, RLS, storage buckets and policies per DATA_MODEL.md. **Ask approval before `npx supabase db push`.** Then `npx supabase gen types typescript --project-id xytwwudbnykackuxfeif > src/types/database.ts`, then typecheck and lint.

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
