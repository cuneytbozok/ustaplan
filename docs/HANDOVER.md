# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.4 is In Progress**: the app shell, common components and domain helpers are verified locally at 360 px. Waiting for push approval (deploy) and the owner's phone check, then M1.4 is closed. Next after that: **M1.5** (Ayarlar).

## Last completed task
**M1.3** (`f477905`, pushed and deployed): Supabase SSR auth, proxy session refresh, `/giris`, the `(app)` guard, logout. The owner verified it on the phone with their own dev account (created via `admin:create-artisan`; its credentials are only with the owner).

## Current or interrupted task
**M1.4**: remaining: push (approval), the owner checks tab navigation + profile sheet + logout on the phone, then close (PROGRESS, HANDOVER, commit).

## Files changed (M1.4)
`src/app/(app)/{layout,error}.tsx`, the `bugun`, `takvim`, `isler`, `musteriler` pages, `src/components/shell/{app-header,bottom-nav,profile-menu}.tsx`, `src/components/common/{empty-state,error-state,skeleton,page-header}.tsx`, `src/components/ui/{sheet,button}.tsx` (shadcn), `src/lib/domain/{labels,time,money,phone,search-fold}.ts`, `src/lib/supabase/count.ts`, `package.json`/lock (`date-fns`, `@date-fns/tz`).

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- **M1.4 deferrals (no dead buttons):** the `+ Yeni iş` FAB arrives with the Yeni iş form (M2.2), the Ayarlar entry in the profile sheet with M1.5, the bell with the inbox (M5.4). Add each to the shell in that task.
- Tab pages show real owner-scoped counts (`countOrThrow`) until their list tasks (M1.6, M2.3, M3.x) replace them. Each page keeps its reads in its own `<Suspense>`.

## Tests executed
M1.4: helper scratch run, local 360 px tab/sheet/logout run, the A/B count isolation probe, typecheck, lint, env-free build. Not yet: phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None after the M1.4 commit. Not pushed (M1.3 close-out + M1.4).

## Exact next action
Ask for push approval → push → the owner checks M1.4 on the phone → close M1.4. Then, on instruction, **M1.5** Ayarlar: profile form (display_name, business_name, contact_phone labelled "Müşterilerin bu numarayı görür") + password change (current/new/confirm, verify current with a throw-away non-persisting client), and add the Ayarlar entry to the profile sheet.

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
