# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.5 is In Progress**: Ayarlar (profile + password change) is verified locally and against dev Supabase. Also added early (plan T-11): web app manifest + home-screen icons, so the installed iOS app stays standalone on every tab. Waiting for push approval (deploy), then the owner re-adds the home-screen app, checks the tabs and smoke-tests Ayarlar, then M1.5 is closed. Next after that: **M1.6** (customers + addresses).

## Last completed task
**M1.4** (`f0ac478`, pushed and deployed): header + profile sheet, bottom tabs, error/empty/skeleton states, domain helpers. The owner verified it on the phone (2026-10-18). Before that, M1.3 (login/guard/logout).

## Current or interrupted task
**M1.5**: remaining: push (approval). The owner **deletes the old home-screen icon and adds it again** (iOS reads the manifest only when you add the app), checks that all tabs stay full-screen with the green "U" icon, and smoke-tests Ayarlar (profile save, optional password change). Then close (PROGRESS, HANDOVER, commit).

M1.5 files: `src/actions/settings.ts`, `src/app/(app)/ayarlar/page.tsx`, `src/components/settings/{profile-form,password-form}.tsx`, `src/components/common/{form-field,form-status}.tsx`, `src/lib/action-result.ts`, `src/components/shell/profile-menu.tsx` (Ayarlar entry); early PWA bits: `src/app/manifest.ts`, `src/app/apple-icon.png`, `public/icons/icon-{192,512}.png`, `appleWebApp` in `src/app/layout.tsx`. Icons were rendered once with `next/og` `ImageResponse` (scratch script, not committed).

## Files changed (M1.4)
`src/app/(app)/{layout,error}.tsx`, the `bugun`, `takvim`, `isler`, `musteriler` pages, `src/components/shell/{app-header,bottom-nav,profile-menu}.tsx`, `src/components/common/{empty-state,error-state,skeleton,page-header}.tsx`, `src/components/ui/{sheet,button}.tsx` (shadcn), `src/lib/domain/{labels,time,money,phone,search-fold}.ts`, `src/lib/supabase/count.ts`, `package.json`/lock (`date-fns`, `@date-fns/tz`).

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- **Deferrals (no dead buttons):** the `+ Yeni iş` FAB arrives with the Yeni iş form (M2.2), the bell with the inbox (M5.4). The Ayarlar entry was added in M1.5.
- M1.5: forms use `useActionState` plus `FormField`/`FormStatus` (`components/common`). Success is shown only from the server's result. Password fields reset after each submit. B's test password was changed in M1.5; the current value is in `.env.local`.
- Tab pages show real owner-scoped counts (`countOrThrow`) until their list tasks (M1.6, M2.3, M3.x) replace them. Each page keeps its reads in its own `<Suspense>`.

## Tests executed
M1.4: helper scratch run, local 360 px tab/sheet/logout run, the A/B count isolation probe, typecheck, lint, env-free build, owner's phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
M1.4 close-out + M1.5 pushed (`6cb7a66`). The manifest commit is local; pushing it needs approval.

## Exact next action
Ask for push approval for the manifest commit → push → the owner re-adds the home-screen app, checks the tabs, smoke-tests Ayarlar → close M1.5. Then, on instruction, **M1.6** customers + addresses (list + Turkish-insensitive search via `search_key`/`foldTr`, create/edit, detail with call/WhatsApp links, address CRUD, delete only without jobs).

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
