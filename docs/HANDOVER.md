# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.3 is In Progress**: login, logout and the route guard work locally with A and B. Waiting for push approval (deploy), then the owner's phone check, then M1.3 is closed.

## Last completed task
**M1.2**: admin scripts + fake artisans A/B (pushed, `40a1523`).

## Current or interrupted task
**M1.3**. Done locally (see PROGRESS evidence). Remaining:
1. Push with approval (deploys to https://ustaplan.vercel.app).
2. The owner logs in and out on the phone with test artisan A (credentials in `.env.local`; give them to the owner privately in chat only if asked, or create a personal account with `admin:create-artisan`).
3. Mark Completed, update the trackers, commit.

## Files changed
`src/lib/supabase/server.ts` (user-scoped client; `await connection()` then `cookies()`), `src/lib/supabase/proxy.ts` (`updateSession`: `getClaims`, optimistic redirects, cookies kept on redirects), `src/proxy.ts` (matcher skips `/t`, `/api/t`, `/api/internal`, `/gizlilik`, `_next`, files with extensions), `src/lib/auth.ts` (`getCurrentArtisan`, React `cache`), `src/actions/auth.ts`, `src/components/auth/login-form.tsx`, `src/app/giris/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/bugun/page.tsx`, `src/app/page.tsx` (redirect fallback), `package.json`/lock (`@supabase/ssr`).

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- `/bugun` is a minimal landing (greeting + Çıkış yap). The real shell and Bugün screen come in M1.4+.

## Tests executed
Local browser-pane run at 360 px (see PROGRESS), curl redirects, typecheck, lint, env-free build. Not yet: phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None after the M1.3 work commit. Not pushed.

## Exact next action
Ask for push approval → push → the owner tests login/logout on the phone → close M1.3 (PROGRESS, HANDOVER, commit).

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
