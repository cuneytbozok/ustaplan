# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M0.2 is Completed** (committed locally, **not pushed**): Next.js scaffold with design tokens, lazy env getters and a branded placeholder page. Next: **M0.3** 🔑 (Supabase dev project), on the owner's instruction.

## Last completed task
**M0.2**: scaffold via `create-next-app@latest` (Next 16.4.2, React 19.3, TS strict, `src/`, App Router, Tailwind 4, ESLint 9 flat config), then `shadcn init` (radix base, Nova preset), zod, Vitest, `server-only`.

## Current or interrupted task
None.

## Files changed
`package.json`/`package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `components.json`, `vitest.config.mts`, `.env.example`, `AGENTS.md` (Next's agent note, re-created by `next dev`), `.claude/launch.json` (dev preview), `src/app/{layout.tsx,page.tsx,globals.css,icon.svg}`, `src/lib/{env.ts,utils.ts}`, `README.md`, `docs/PROGRESS.md`, this file.

## Key decisions
- **Kept the create-next-app 16.4 defaults `cacheComponents: true` and `partialPrefetching: true`** (Turbopack Tailwind loader too). Dynamic data (e.g. `cookies()` for auth in M1.3) must then sit inside `<Suspense>`; read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` before M1.3. Removing the two flags is a one-line revert if they get in the way.
- Next 16 ships its docs in `node_modules/next/dist/docs/`; read those before using Next APIs (see `AGENTS.md`).
- `src/lib/env.ts` is `server-only`: getters `supabaseEnv`, `appEnv` (APP_BASE_URL, added to the plan's list), `adminEnv`, `shareLinkEnv`, `pushEnv`, `cronEnv`. Client components read `NEXT_PUBLIC_*` directly.
- Tokens are in `globals.css`, with shadcn's variable names mapped onto them. Light theme only, system font (Geist removed). Utilities: `bg-primary`, `bg-primary-soft`, `text-ink`, `text-muted-foreground`, `border-border`, `text-warning`, `text-danger`.
- shadcn components are added only when a task uses them (the generated `button.tsx` was removed). `cn` comes from the official `cn` package (shadcn-ui/cn) via `@/lib/utils`.
- `@types/node` ^24 (Vitest 5 peer) and `engines.node >=24`.
- `npm test` = `vitest run --passWithNoTests` over `tests/**/*.test.ts`.

## Tests executed
With an empty environment: `npm run typecheck`, `lint`, `test`, `build` all exit 0. A script checked the env getters: missing variable error, `NEXT_PUBLIC_` secret rejected, base URL normalised. Browser-pane smoke test at 360 px: OK, no console errors.

## Known bugs and blockers
- `npm audit`: 5 high, all in the dev-only `eslint-config-next` → `fast-glob` → `braces` chain. Not shipped to users. Accepted until upstream fixes.
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None. **Local `main` is ahead of `origin` by the M0.2 commit; pushing needs owner approval** (no Vercel project yet, so it won't deploy).

## Exact next action
On "start the next task", do **M0.3** 🔑: ask the owner to create the Supabase **dev** project (Frankfurt), or to approve creating it via the connector. Disable signup, put the keys in `.env.local`, and run `npx supabase link` (the owner provides the DB password). Add the `supabase` CLI as a dev dependency.

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
