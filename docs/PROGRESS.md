# UstaPlan — Progress Tracker

Live, verified state of development. Workflow rules: [CLAUDE.md](../CLAUDE.md). Task content and "done when" criteria: [IMPLEMENTATION_PLAN.md §13](IMPLEMENTATION_PLAN.md#13-milestones-and-tasks).

A task is **Completed** only when it works, typecheck and lint pass, the smoke test is done, the security check or Vitest tests pass where named, and no critical issue remains. Production builds run at milestone ends, before deploys, and after significant changes. Planned is not implemented.

**Statuses:** `Pending` · `In Progress` · `Completed` · `Blocked`. At most one task is In Progress. 🔑 = needs owner input or approval.

## Current state

| | |
| --- | --- |
| Plan version | v3.1 (fast path) — **approved**; planning complete |
| Current milestone | M2 |
| Active task | **M2.3** (In Progress: verified locally, waiting for deploy + phone smoke) |
| Next task | M2.4 (after M2.3 is closed) |
| Application code | Login/logout (M1.3), app shell (M1.4), Ayarlar + manifest (M1.5), customers + addresses (M1.6); DB `core` on dev |
| Implementation tasks | 37 total · 13 completed · 24 remaining |
| Last updated | 2026-10-17 |

## Blockers and owner inputs

| Item | Needed for | Status |
| --- | --- | --- |
| Approve the first `git push` to public repo `cuneytbozok/ustaplan` | M0.1 | Done (approved 2026-10-17) |
| Create the Supabase **dev** project (or approve creating it via connector); provide the DB password for `supabase link` | M0.3 | Done: `xytwwudbnykackuxfeif`, Ireland (accepted, plan T-10) |
| Create or connect the Vercel project to GitHub; paste the secret env vars | M0.4 | Done: project `ustaplan`, https://ustaplan.vercel.app |
| Set Vercel Function Region to Dublin (`dub1`), near the Ireland DB (default is `iad1`) | before M1.3 | Done: owner set Dublin (2026-10-17) |
| Approve each migration push to dev | M1.1 ✓, M2.1 ✓, M3.1, M5.1, M5.3, M5.8 | Ask per task (M2.1 approved 2026-10-18) |
| Leaked password protection (Supabase Auth, HaveIBeenPwned) is off; advisor warns | before pilot (M6.3) | Owner to decide; may need a paid plan |
| Approve creating the fake test users in dev | M1.2 | Done (approved 2026-10-17) |
| Add VAPID keys to Vercel; run the Vault secrets SQL template | M5.6, M5.8 | Ask per task |
| A phone for testing (an iPhone 16.4+ and/or Android for push) | from M0.4 | Assumed available |
| KVKK legal review (notice + cross-border transfer) | M6.3 (real customer data) | Open |
| Create the **prod** Supabase project; switch Vercel env | M6.3 | Ask at M6.3 |

---

## Planning (done)
| ID | Task | Status | Evidence |
| --- | --- | --- | --- |
| P.1 | Review source docs, organise `docs/`, README, CLAUDE.md, plan v1 | Completed | 2026-10-17 |
| P.2 | Owner decisions Q1–Q5 + Web Push → spec v1.4, DATA_MODEL.md, privacy doc, plan v2 | Completed | 2026-10-17 |
| P.3 | Task-by-task workflow (CLAUDE.md, PROGRESS.md, HANDOVER.md) | Completed | 2026-10-17 |
| P.4 | Plan v3 fast path: no Docker, early deploy, light verification, 7 milestones, 9 RPCs | Completed | Grep shows no Docker/pgTAP/E2E requirements left (2026-10-17) |
| P.5 | Owner approves plan v3 with four corrections (v3.1: timestamped migrations, per-feature env validation, M1.2/M1.3 order, build cadence) | Completed | Owner approval in chat; corrections applied (2026-10-17) |

---

## M0 — Foundation, Supabase Cloud, Vercel · depends on P.5
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M0.1 🔑 | `git init`, `.gitignore`, commit docs, add remote, push (approval) | Completed | Repo on `main`; `.gitignore` added; secret-pattern grep over docs clean; commit `6c2e2ac` pushed with owner approval; `git ls-remote` shows `refs/heads/main` = `6c2e2ac` (2026-10-17) |
| M0.2 | Scaffold Next.js + Tailwind tokens + shadcn init + ESLint + Vitest + scripts + `lib/env.ts` (lazy per-feature getters) + `.env.example` + branded placeholder; build passes with no env vars | Completed | Next 16.4.2, React 19.3, Tailwind 4, shadcn (radix-nova), zod 4, Vitest 5. With an empty environment (`env -i`): `typecheck`, `lint`, `test` (no tests yet) and `build` all exit 0. Env getters checked by script: missing var → error naming it; `NEXT_PUBLIC_<secret>` → rejected; `APP_BASE_URL` trailing slash trimmed. Smoke at 360 px in the browser pane: tokens, system font, `lang=tr`, noindex, theme-color, U icon, no horizontal scroll, no console errors. `npm audit`: 5 high in the dev-only ESLint chain (`braces` via `eslint-config-next`); the only fix is a downgrade to Next 14's config, so accepted (2026-10-17) |
| M0.3 🔑 | Supabase dev project, signup off, `.env.local`, `supabase link` | Completed | Owner created dev project `xytwwudbnykackuxfeif` (`eu-west-1`; a first one in Sydney was deleted; Ireland accepted by owner, plan T-10). `supabase` CLI 2.121 dev dep; `supabase init` (signup off in `config.toml` too). `supabase link` succeeded. `.env.local` has URL + publishable key. Auth settings: `disable_signup: true`, email provider on; signup attempt → 422 `signup_disabled`. `supabaseEnv()`/`appEnv()` read `.env.local` correctly. typecheck + lint pass (2026-10-17) |
| M0.4 🔑 | Vercel project, env vars, `APP_BASE_URL`, first deploy (approval); open on phone | Completed | Owner created Vercel project `ustaplan` and connected GitHub. The first deploy failed because the preset was not Next.js (looked for `public/`); fixed by setting the Next.js preset. Production env (plain): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_BASE_URL=https://ustaplan.vercel.app`. `npm run build` passed locally before the deploy. `curl` → 200, `lang=tr`, title UstaPlan, noindex, theme-color, `/icon.svg` 200, HSTS. **Owner confirmed it opens on the phone.** Function region set to Dublin (`dub1`) by the owner (2026-10-17) |

## M1 — Auth, RLS, customers and addresses · depends on M0
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M1.1 🔑 | Migration `core` (via `supabase migration new`) → dev (approval); generate types | Completed | `supabase/migrations/20261017203619_core.sql`. Before the push: PGlite (PG 17) dry run with stubbed auth/storage, **41/41 checks** (cross-user RLS, anon denied, column grants, job insert/delete denied, consistency checks, set-null address, media checks, storage folder policies); `db push --dry-run` OK. Pushed with owner approval. Live dev: 10 tables with RLS, anon has no select, insert/delete grants exactly per §3, `jobs.status` not updatable, anon can't run `fold_tr`, 23 public + 3 storage policies, 2 private buckets (2 MB / 4 MB + MIME lists); anon REST → 42501; `supabase db advisors` → no issues. `src/types/database.ts` generated. typecheck + lint pass. **Not yet done:** the `security-check.ts` re-run (script arrives in M1.7). Docs: fixed the CLAUDE.md/DATA_MODEL `share_*` contradiction in favour of DATA_MODEL §3 (2026-10-17) |
| M1.2 🔑 | Admin scripts (`create-artisan`, `reset-password`); create fake artisans A and B in dev (approval) | Completed | `scripts/create-artisan.ts`, `scripts/reset-password.ts`, `scripts/admin-shared.ts`, `src/lib/supabase/admin.ts`; npm scripts `admin:*` (tsx, `.env.local`, `react-server` condition). `SUPABASE_SECRET_KEY` piped from the CLI (`--reveal`) into `.env.local`, never displayed (owner-approved). **Rollback:** a forced profile-insert failure removed the auth user (0 users after). Created `usta-a@` / `usta-b@ustaplan.test` + profiles (owner-approved); credentials only in `.env.local` (`TEST_ARTISAN_*`). Live checks: A and B sign in and each sees only their own profile; after reset, B's old password → `invalid_credentials`, new one works; duplicate email (case-insensitive) and unknown email are refused. typecheck + lint pass (2026-10-17) |
| M1.3 | Supabase clients, `proxy.ts`, `(app)` guard, `/giris`, logout; verify login with A and B | Completed | Built: `lib/supabase/{server,proxy}.ts`, `src/proxy.ts`, `lib/auth.ts` (`getCurrentArtisan`, `getClaims`), `actions/auth.ts` (signIn/signOut), `/giris`, `(app)` layout guard, minimal `/bugun`. **Local (dev server, 360 px):** anonymous `/`, `/bugun`, `/takvim` → 307 `/giris`; `/t/…`, `/gizlilik`, `/icon.svg` bypass the proxy; wrong password → "E-posta veya şifre hatalı." (email kept); show/hide toggles; A logs in → "Merhaba, Test Usta A"; logout clears `sb-` cookies and `/bugun` → `/giris`; B logs in → B only; signed-in `/giris` and `/` → `/bugun`; no server errors. typecheck, lint, build **without `.env.local`** pass. **Production** (`f477905`, pushed with approval): anonymous `/` and `/bugun` → 307 `/giris`; the login page serves the forgot-password sentence. **Owner's phone** (own dev account created with `admin:create-artisan`): wrong password refused, login shows the name, logout returns to `/giris` (2026-10-17) |
| M1.4 | App shell + common components + domain helpers | Completed | Shell: sticky header (wordmark + profile sheet with name, email, Çıkış yap), fixed bottom nav (Bugün · Takvim · İşler · Müşteriler, `aria-current`, 64 px targets, safe areas), `(app)/error.tsx` (error + Tekrar dene). Common: `EmptyState`, `ErrorState`, `Skeleton`/`ListSkeleton`, `PageHeader`; shadcn `Sheet` (close button 44 px, "Kapat"). Domain: `labels.ts`, `time.ts` (Istanbul formatters, day/week UTC ranges via `@date-fns/tz`), `money.ts` (formatTRY, parseTurkishPrice), `phone.ts` (E.164 normalise/format), `search-fold.ts` (mirrors SQL `fold_tr`); a scratch run checked Istanbul midnight/week bounds, price parsing (9 cases), phones (6 cases) and folding. Tab pages show **real** owner-scoped counts with empty states, each inside its own Suspense. **Local 360 px:** login A → all 4 tabs route with the active state; no horizontal scroll; profile sheet → logout. A fake customer for A showed "1 müşterin var." for A while B counted 0 (deleted afterwards). typecheck, lint, env-free build pass. **Deliberately deferred (no dead buttons):** `+ Yeni iş` FAB → M2.2 with the form; Ayarlar in the profile sheet → M1.5; bell → M5.4 (inbox). ErrorState UI not seen live (no failing query to trigger). **Owner's phone** (`f0ac478`, pushed with approval): all 4 tabs open with the right empty states, nothing cut off, profile sheet shows the name, logout works (2026-10-18) |
| M1.5 | Ayarlar: profile + password change | Completed | `/ayarlar` (Profil, Şifre, Çıkış yap) + Ayarlar entry in the profile sheet. `actions/settings.ts`: `updateProfile` (zod, E.164 via `normalizePhone`, `getClaims` re-check, RLS update, `refresh()`), `changePassword` (zod: min 8, confirm match, new ≠ current; current verified with a throw-away non-persisting client, then signed out; `updateUser` on the user's session). Shared `FormField`/`FormStatus`, `ActionResult` type. Labels: name/business "Müşteri de görür.", phone "Müşterilerin bu numarayı görür." **Local 360 px as B:** invalid phone → field error, nothing saved; valid save → "Bilgilerin kaydedildi.", persists after reload (phone shown 0532 000 00 02, stored E.164); wrong current password → "Mevcut şifren hatalı." and fields cleared; mismatch → "Şifreler aynı değil."; valid change → "Şifren değiştirildi.", session kept. **Against Supabase:** B's old password → `invalid_credentials`, new → OK (`.env.local` updated). Logout from Ayarlar works; no server errors. typecheck, lint, env-free build pass. **Added (owner-approved plan change T-11):** the owner saw the iOS home-screen app open every tab except the saved one in an in-app browser (no manifest → iOS can't know the app's scope). Added `src/app/manifest.ts` (`scope: "/"`, `start_url: /bugun`, standalone, theme/background colours), `src/app/apple-icon.png` (180), `public/icons/icon-{192,512}.png` (any + maskable), `appleWebApp` metadata (title "UstaPlan"). Locally: manifest and icons 200 for signed-out visitors (outside the proxy); head has `manifest`, `apple-touch-icon` and `apple-mobile-web-app-*`. Build passes. **Production** (`5bb5bb6`): manifest + apple-icon served 200, head tags present. **Owner's iPhone:** re-added home-screen app shows "UstaPlan" with the green U, all tabs stay full-screen, Ayarlar saves the profile (2026-10-18). Android not tested (no device): manifest meets Chrome install criteria on paper; real check in M6.1 |
| M1.6 | Customers + addresses (list, search, CRUD, detail, delete rule) | Completed | `/musteriler` (debounced `?q=` search on `search_key` with `foldTr`, or phone digits via `phoneSearchDigits`; LIKE wildcards escaped), `/musteriler/yeni`, `/musteriler/[id]` (Ara `tel:`, WhatsApp `wa.me`, private note "Sadece sen görürsün", addresses add/edit/delete inline with "Haritada aç" Google Maps link, the customer's jobs, two-step delete only when there are no jobs), `/musteriler/[id]/duzenle`. Actions in `actions/customers.ts` (zod, `actionContext()` `getClaims` re-check, RLS, `refresh()` for addresses, FK 23503 → friendly message). Shared: `BackLink`, `ConfirmAction`, `NotFoundState`, `lib/domain/links.ts`. **Local 360 px as test artisan C:** invalid phone rejected (other fields kept); create "Işık Yılmaz" → detail with `tel:+905321112233` and `https://wa.me/905321112233`; address add + edit (form closes only after the save); **search "isik" finds "Işık Yılmaz"**, plus IŞIK, yılmaz, YILMAZ, "0532 111", 5321112233, "+90 532"; xyz, `%`, `_` → Sonuç yok; edit name persists; with a job added behind the page (admin probe), delete → "Bu müşterinin işleri var…" and after a reload the delete button is replaced; address delete; customer delete → list empty; a deleted or invalid id → "Bulunamadı". **RLS (live, as B):** select/update/delete of C's customer → 0 rows, inserting an address on it → 23503. **Fixes found on the way:** (1) `BottomNav`'s `usePathname()` must sit inside `<Suspense>` on dynamic routes (fallback = nav without highlight); (2) `notFound()` thrown inside a streamed Suspense left the skeleton on screen, so pages render `NotFoundState` inline (`(app)/not-found.tsx` kept for pre-stream cases). typecheck, lint, env-free build pass. **Owner's iPhone** (`5fa757d`, pushed with approval): create, address, Haritada aç, Ara, WhatsApp, search "isik" and delete all worked (2026-10-18) |
| M1.7 | `security-check.ts` v1 (RLS, anon, storage, workflow columns) | Completed | `scripts/security-check.ts` + `npm run security-check`. Creates tagged fake fixtures for role A in **every** table (plus a storage object and a job for B) with the admin client, checks, then cleans up (verified: no leftover rows or objects). **89/89 PASS against dev:** 11 positive controls (A sees its own rows and object), 10 write controls (A's identical statements succeed, so B's zero results are RLS), B→A select/update/delete/cross-owner insert on all tables (28), anon select/insert/update/delete/RPC denied (14), workflow columns denied for the owner (15: job insert/status/completed/cancelled/owner/delete, appointments, requests, events, notifications, media origin, customer-origin media, estimate-only price), storage (10: B download/list/upload/foreign-job upload/delete, anon download/list/upload, no overwrite, buckets private). Exit code 1 on any FAIL, 2 if it can't run; no secrets printed. Milestone build (env-free), lint, typecheck pass (2026-10-18) |

## M2 — Jobs, statuses, pricing, search, history · depends on M1
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M2.1 🔑 | Migration `jobs` (`create_job`, `change_job_status`, `jobs_log_changes`) → dev (approval) | Completed | `supabase/migrations/20261017214332_jobs.sql`. PGlite dry run (core + jobs) **50/50**: inline/existing customer, first appointment, idempotent repeat, foreign customer/address/job id refused, J1/J4 (future appointment cancelled, ended visit untouched, open request closed)/J5/J6, idempotent transitions, `not_found` for foreign jobs, trigger logs prices/visibility/share/title (not private note), `share_version` can't decrease, no phone/address in events, anon denied. `db push` with owner approval; types regenerated. Catalog: anon executes nothing; trigger function not executable by authenticated; all `search_path=""`. Advisors: lint 0029 for the 2 RPCs (accepted by design, plan T-12) + leaked-password protection off (open item). `security-check` extended → **98/98 PASS** (B's `change_job_status` → not_found with status unchanged, B `create_job` with A's customer/job id refused, anon RPCs denied, trigger not callable, `share_version` can't be lowered, owner control OK). typecheck + lint pass (2026-10-18) |
| M2.2 | Yeni iş form (recent chips, inline customer, Diğer detaylar) | Completed | `/isler/yeni` + `actions/jobs.ts` `createJob` → `create_job` RPC with a client-generated job id (idempotent). Recent-customer chips (latest jobs' customers, then recently edited), "Diğer müşteri" search, inline "Yeni müşteri" (name + optional E.164 phone), "Yapılacak iş" ("Müşteri de görür."), Diğer detaylar: address radio list of the chosen customer, agreed price + "Anlaşılan fiyatı müşteri görsün" (disabled without an agreed price), estimate + private note ("Sadece sen görürsün."), sticky "İşi kaydet". Choosing a chip or arriving with `?musteri=` focuses the title. `+ Yeni iş` FAB on the 4 tab pages only (in Suspense, it reads the URL); "Yeni iş" button on the customer page. After saving → the customer page (job detail is M2.4). **Local 360 px as C:** validation (missing name, bad estimate) keeps values and opens details; inline new customer + prices + note saved (DB: agreed 2500.50 shown, estimate 2000, phone +905332223344, `job_created` event); **existing customer in 4 interactions** (FAB → chip → type → İşi kaydet); from the customer page in 3; address selection stored. typecheck, lint, env-free build pass. **Owner's iPhone** (`ee90f49`, pushed): creating jobs works. Owner feedback: the no-address radio option was renamed from "Adres seçme" to **"Adres Seç"** (owner's wording). Jobs list/edit come in M2.3/M2.4; no delete by design (P-3) (2026-10-18) |
| M2.3 | İşler list: filters + search | In Progress | `/isler`: Açık / Tamamlanan / İptal (`?durum=`, links keep `?q=`; unknown value → Açık), ordered by updated/completed/cancelled time, limit 200 with a hint. Search on job title (`jobs.search_key`) plus jobs of customers matching name/phone (`customers.search_key`), merged. Rows: title, customer, date, `JobStatusBadge` (colour + text; also used on the customer page). Rows aren't links until the detail page exists (M2.4). Refactor: `CustomerSearch` → shared `SearchBox` (keeps other query params), `lib/search.ts` (`readQuery`, `searchKeyPattern`). **Local 360 px as C** (statuses set through `change_job_status`: one completed, one cancelled, one in progress): each filter shows only its status; petek/PETEK/caglar/Öztürk/"0533 222"/5332223344 find the job; filter+query combinations correct; xyz and `%` → Sonuç yok; the typed query survives a filter switch; customer search regression OK; no server errors. typecheck, lint, env-free build pass. **Remaining:** deploy + phone smoke (2026-10-18) |
| M2.4 | İş detayı: edit, price + history, status sheet, reopen, timeline | Pending | |

## M3 — Appointments, conflicts, calendar, Bugün · depends on M2
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M3.1 🔑 | Migration `appointments` (`save_appointment`, `close_appointment`) → dev (approval) | Pending | |
| M3.2 | `scheduling.ts` + Vitest | Pending | |
| M3.3 | AppointmentPicker + ConflictCard; reschedule, complete, cancel a visit | Pending | |
| M3.4 | Takvim day/week | Pending | |
| M3.5 | Bugün (summary, today, Takip gerekenler incl. overdue) | Pending | |

## M4 — Media, customer links, WhatsApp, customer page · depends on M3
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M4.1 | Image preparation (HEIC/compress/EXIF) + artisan photos | Pending | |
| M4.2 | Voice notes | Pending | |
| M4.3 | `share-link.ts` + DTO (Vitest), `/t/[token]`, invalid page, headers, media proxy | Pending | |
| M4.4 | Share sheet, WhatsApp message, disable/regenerate, customer contact buttons, `/gizlilik` | Pending | |
| M4.5 | `security-check.ts` v2 (links, exposure, read-only GET, customer media) | Pending | |

## M5 — Customer actions, notifications, PWA, Web Push · depends on M4
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M5.1 🔑 | Migration `customer_cancel` (`public_cancel_job`, approval) + cancel flow + in-app notification | Pending | |
| M5.2 | Customer photo upload/delete + in-app notification | Pending | |
| M5.3 🔑 | Migration `reschedule` (approval) + customer and artisan negotiation UI | Pending | |
| M5.4 | Inbox: bell, badge, `/bildirimler` | Pending | |
| M5.5 | PWA: `sw.js`, install guide (manifest + icons done early in M1.5, plan T-11) | Pending | |
| M5.6 🔑 | Web Push subscriptions + settings + test push (VAPID keys in Vercel) | Pending | |
| M5.7 | Immediate pushes (cancel, request, counter accepted) | Pending | |
| M5.8 🔑 | Dispatcher (reminders, digest, retries, cleanup) + migration `cron` + Vault (approval) | Pending | |
| M5.9 | `security-check.ts` v3 (consistency, dispatcher auth) | Pending | |

## M6 — Pilot readiness · depends on M5
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M6.1 | Full mobile smoke pass + critical fixes | Pending | |
| M6.2 | Backup, delete/export scripts, RUNBOOK.md | Pending | |
| M6.3 🔑 | Prod Supabase project, switch Vercel env, pilot accounts, prod smoke (approval; KVKK review) | Pending | |

---

## Completed task log
| Date | Task | Commit | Evidence |
| --- | --- | --- | --- |
| 2026-10-17 | P.1–P.5 planning complete (plan v3.1 approved) | — (not a git repo yet) | Docs reviewed; stale-reference grep clean |
| 2026-10-17 | M0.1 git init + docs on GitHub | `6c2e2ac` | Pushed with approval; remote `main` matches local |
| 2026-10-17 | M0.2 Next.js scaffold | `1c90c69` | typecheck/lint/test/build pass with no env vars; 360 px smoke |
| 2026-10-17 | M0.3 Supabase dev project + link | `65fac03` | link OK; signup → 422 `signup_disabled`; env read OK |
| 2026-10-17 | M0.4 Vercel deploy (**M0 complete**) | `a9ceb52` | https://ustaplan.vercel.app opens on the owner's phone; build passed |
| 2026-10-17 | M1.1 core migration on dev | `00754f7` | 41/41 PGlite checks; live catalog + advisors clean |
| 2026-10-17 | M1.2 admin scripts + test artisans A/B | `40a1523` | rollback, sign-in, reset verified on dev |
| 2026-10-17 | M1.3 login, guard, logout | `f477905` | local A/B flows; prod redirects; owner's phone OK |
| 2026-10-18 | M1.4 app shell, common states, domain helpers | `f0ac478` | local 360 px + count isolation; owner's phone OK |
| 2026-10-18 | M1.5 Ayarlar + early manifest (T-11) | `6cb7a66`, `5bb5bb6` | local B flows + Supabase password check; owner's iPhone OK |
| 2026-10-18 | M1.6 customers + addresses | `5fa757d` | local flows as C, live RLS probe as B; owner's iPhone OK |
| 2026-10-18 | M1.7 security-check v1 (**M1 complete**) | `e9fc6c1` | 89/89 PASS against dev; milestone build OK |
| 2026-10-18 | M2.1 jobs migration on dev | `22362cc` | PGlite 50/50; security-check 98/98 |
| 2026-10-18 | M2.2 Yeni iş form + FAB | `ee90f49` | 4 interactions locally; owner's iPhone OK |
