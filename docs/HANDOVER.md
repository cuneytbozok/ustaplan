# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.3 is Completed**: login, logout and the route guard work locally (A/B), in production and on the owner's phone. Next: **M1.4** (app shell, common components, domain helpers), on the owner's instruction.

## Last completed task
**M1.3** (`f477905`, pushed and deployed): Supabase SSR auth, proxy session refresh, `/giris`, the `(app)` guard, logout. The owner verified it on the phone with their own dev account (created via `admin:create-artisan`; its credentials are only with the owner).

## Current or interrupted task
None.

## Files changed
`src/lib/supabase/server.ts` (user-scoped client; `await connection()` then `cookies()`), `src/lib/supabase/proxy.ts` (`updateSession`: `getClaims`, optimistic redirects, cookies kept on redirects), `src/proxy.ts` (matcher skips `/t`, `/api/t`, `/api/internal`, `/gizlilik`, `_next`, files with extensions), `src/lib/auth.ts` (`getCurrentArtisan`, React `cache`), `src/actions/auth.ts`, `src/components/auth/login-form.tsx`, `src/app/giris/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/bugun/page.tsx`, `src/app/page.tsx` (redirect fallback), `package.json`/lock (`@supabase/ssr`).

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- `/bugun` is a minimal landing (greeting + Çıkış yap). The real shell and Bugün screen come in M1.4+.

## Tests executed
Local browser-pane run at 360 px (see PROGRESS), curl redirects (local + prod), typecheck, lint, env-free build, owner's phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None. The M1.3 close-out tracker commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M1.4**: app shell (header with bell + profile sheet with Ayarlar/Çıkış, bottom tabs Bugün · Takvim · İşler · Müşteriler, `+ Yeni iş` FAB), common components (skeleton, empty state, error + retry), domain helpers (`labels.ts`, money, time, phone, whatsapp, search-fold) per plan §2 and §10. Remember the Cache Components rules above (own `<Suspense>` per page). Each tab must be a real route, with no dead buttons.

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
