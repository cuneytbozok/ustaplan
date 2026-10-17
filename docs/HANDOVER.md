# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M0.1 is Completed**: the docs are on GitHub (`cuneytbozok/ustaplan`, public, branch `main`). No application code exists. Next: **M0.2**, on the owner's instruction.

## Last completed task
**M0.1** 🔑: `git init -b main`, `.gitignore`, docs committed (`6c2e2ac`), `origin` set, pushed with owner approval. A tracker-update commit followed.

## Current or interrupted task
None.

## Files changed
`.gitignore` (new), `docs/PROGRESS.md`, `docs/HANDOVER.md`.

## Key decisions
- The repo is public: `.gitignore` excludes every `.env*` except `.env.example`, plus `*.pem`, `.vercel/`, `supabase/.temp/`, `.DS_Store`.
- Planning decisions are unchanged (plan v3.1, §15).

## Tests executed
Secret-pattern grep over the repo before the first push: no matches. `git ls-remote origin` shows `refs/heads/main` at the pushed commit.

## Known bugs and blockers
- KVKK legal review is open; it blocks only M6.3.
- No Vercel project is connected yet, so pushes don't deploy until M0.4.

## Uncommitted changes
None.

## Exact next action
When the owner says "start the next task", do **M0.2**: scaffold Next.js (strict TS, `src/`, `lang="tr"`, UstaPlan metadata), Tailwind tokens, shadcn init, ESLint, Vitest, scripts, `lib/env.ts` (lazy per-feature getters), `.env.example`, branded placeholder page. Done when typecheck, lint and build pass locally **with no env vars set**. Check current Next.js docs first.

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git log --oneline -15
```
