# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-18._

## State in one line
**M1.6 is In Progress**: customers + addresses are verified locally (as test artisan C) and against dev RLS. Waiting for push approval (deploy) and the owner's phone check, then M1.6 is closed. Next after that: **M1.7** (`security-check.ts` v1).

## Last completed task
**M1.5** (`6cb7a66`, `5bb5bb6`, closed in `ae813ba`): Ayarlar + early web app manifest (T-11). Verified on the owner's iPhone.

## Current or interrupted task
**M1.6**: remaining: push (approval). On the phone (own account) the owner creates a customer with phone + address, searches without Turkish letters, taps Ara, WhatsApp and Haritada aç, then deletes a test customer. Then close (PROGRESS, HANDOVER, commit).

## Files changed (M1.6)
`src/actions/customers.ts`, `src/app/(app)/musteriler/{page,yeni/page,[id]/page,[id]/duzenle/page}.tsx`, `src/app/(app)/not-found.tsx`, `src/components/customers/{customer-form,customer-search,address-form,address-section}.tsx`, `src/components/common/{back-link,confirm-action,not-found-state}.tsx`, `src/lib/auth-action.ts`, `src/lib/domain/links.ts`, `phoneSearchDigits` in `src/lib/domain/phone.ts`, `src/components/shell/bottom-nav.tsx` + `src/app/(app)/layout.tsx` (Suspense fix), `src/app/(app)/ayarlar/page.tsx` (uses `BackLink`).

## Key decisions
- **Cache Components rules learned:** (1) every Supabase render read needs `await connection()` first, because `getClaims` uses `Date.now()`, which runtime prerendering forbids; this lives in `createClient()`. (2) The layout's Suspense isn't enough for instant navigation: **each page must put its own request-time reads inside its own `<Suspense>`**, with the static parts outside. (3) The env read comes after `connection()`, so `npm run build` still needs no env (verified with `.env.local` moved aside; note `env -i` doesn't stop Next from loading `.env.local`).
- No browser Supabase client yet (nothing needs it); add `lib/supabase/browser.ts` when a client component first needs Supabase.
- Logout uses `signOut({ scope: "local" })` (this device only). Push-subscription removal is added in M5.6.
- A missing profile throws (error page) rather than redirecting, to avoid a `/giris` ↔ `/bugun` loop.
- **Cache Components lessons (M1.6):** client hooks that read the URL (`usePathname`, `useSearchParams`) must render inside `<Suspense>`. Don't call `notFound()` inside streamed content: render `NotFoundState` instead. In browser tests, `innerText` includes the hidden fallback's "Yükleniyor…", so check visually or with element queries.
- Every new artisan Server Action starts with `actionContext()` (`lib/auth-action.ts`). `settings.ts` predates it and has its own inline `getClaims`.
- **Deferrals (no dead buttons):** the `+ Yeni iş` FAB arrives with the Yeni iş form (M2.2), the bell with the inbox (M5.4). The Ayarlar entry was added in M1.5.
- M1.5: forms use `useActionState` plus `FormField`/`FormStatus` (`components/common`). Success is shown only from the server's result. Password fields reset after each submit. B's test password was changed in M1.5; the current value is in `.env.local`.
- Tab pages show real owner-scoped counts (`countOrThrow`) until their list tasks (M1.6, M2.3, M3.x) replace them. Each page keeps its reads in its own `<Suspense>`.

## Tests executed
M1.4: helper scratch run, local 360 px tab/sheet/logout run, the A/B count isolation probe, typecheck, lint, env-free build, owner's phone.

## Known bugs and blockers
- `npm audit`: 5 high in the dev-only ESLint chain (accepted).
- KVKK legal review is open; it blocks only M6.3.

## Uncommitted changes
None after the M1.6 commit. Not pushed (M1.5 close-out + M1.6).

## Exact next action
Ask for push approval → push → the owner checks M1.6 on the phone → close M1.6. Then, on instruction, **M1.7** `scripts/security-check.ts` v1: RLS isolation for every table, anon denial, storage isolation, workflow-column denial, against dev with roles A/B from `.env.local`; prints PASS/FAIL.

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
