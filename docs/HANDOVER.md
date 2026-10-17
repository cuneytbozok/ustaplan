# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M1.5 is Completed**: Ayarlar (profile + password change) and the early web app manifest work locally, in production and on the owner's iPhone. Next: **M1.6** (customers + addresses), on the owner's instruction.

## Last completed task
**M1.5** (`6cb7a66` + `5bb5bb6`, pushed): Ayarlar plus the manifest/icons moved forward from M5.5 (plan T-11). The owner re-added the iPhone home-screen app: green U, all tabs standalone, profile saves.

## Current or interrupted task
None.

## Files changed (M1.5)
 `src/actions/settings.ts`, `src/app/(app)/ayarlar/page.tsx`, `src/components/settings/{profile-form,password-form}.tsx`, `src/components/common/{form-field,form-status}.tsx`, `src/lib/action-result.ts`, `src/components/shell/profile-menu.tsx` (Ayarlar entry); early PWA bits: `src/app/manifest.ts`, `src/app/apple-icon.png`, `public/icons/icon-{192,512}.png`, `appleWebApp` in `src/app/layout.tsx`. Icons were rendered once with `next/og` `ImageResponse` (scratch script, not committed).

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
None. The M1.5 close-out tracker commit is local; push it with the next approved push.

## Exact next action
On "start the next task", do **M1.6** customers + addresses: list + Turkish-insensitive search (`search_key` + `foldTr`), create/edit (phone via `normalizePhone`, labels per the form conventions), detail with call (`telHref`) and WhatsApp (`wa.me`) links, address CRUD, delete only when the customer has no jobs (FK restrict → friendly message). Done when: create → search "isik" finds "Işık" → address → call/WhatsApp links. Android is untested so far; keep it on the M6.1 list.

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
