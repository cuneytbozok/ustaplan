# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-17._

## State in one line
**M1.5 is In Progress**: Ayarlar (profile + password change) is verified locally and against dev Supabase. Waiting for push approval (deploy) and the owner's phone smoke, then M1.5 is closed. Next after that: **M1.6** (customers + addresses).

## Last completed task
**M1.4** (`f0ac478`, pushed and deployed): header + profile sheet, bottom tabs, error/empty/skeleton states, domain helpers. The owner verified it on the phone (2026-10-18). Before that, M1.3 (login/guard/logout).

## Current or interrupted task
**M1.5**: remaining: push (approval), the owner opens Ayarlar on the phone, saves the profile and (optionally) changes their own password, then close (PROGRESS, HANDOVER, commit).

M1.5 files: `src/actions/settings.ts`, `src/app/(app)/ayarlar/page.tsx`, `src/components/settings/{profile-form,password-form}.tsx`, `src/components/common/{form-field,form-status}.tsx`, `src/lib/action-result.ts`, `src/components/shell/profile-menu.tsx` (Ayarlar entry).

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
None after the M1.5 commit. Not pushed (M1.4 close-out + M1.5).

## Exact next action
Ask for push approval → push → the owner smoke-tests Ayarlar on the phone → close M1.5. Then, on instruction, **M1.6** customers + addresses (list + Turkish-insensitive search via `search_key`/`foldTr`, create/edit, detail with call/WhatsApp links, address CRUD, delete only without jobs).

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
