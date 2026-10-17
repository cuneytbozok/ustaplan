# UstaPlan — Progress Tracker

Live, verified state of development. Workflow rules: [CLAUDE.md](../CLAUDE.md). Task content and "done when" criteria: [IMPLEMENTATION_PLAN.md §13](IMPLEMENTATION_PLAN.md#13-milestones-and-tasks).

A task is **Completed** only when it works, typecheck and lint pass, the smoke test is done, the security check or Vitest tests pass where named, and no critical issue remains. Production builds run at milestone ends, before deploys, and after significant changes. Planned is not implemented.

**Statuses:** `Pending` · `In Progress` · `Completed` · `Blocked`. At most one task is In Progress. 🔑 = needs owner input or approval.

## Current state

| | |
| --- | --- |
| Plan version | v3.1 (fast path) — **approved**; planning complete |
| Current milestone | M1 |
| Active task | **M1.5** (In Progress: verified locally, waiting for deploy + phone smoke) |
| Next task | M1.6 (after M1.5 is closed) |
| Application code | Login/logout (M1.3), app shell with 4 tabs (M1.4); DB `core` on dev |
| Implementation tasks | 37 total · 8 completed · 29 remaining |
| Last updated | 2026-10-17 |

## Blockers and owner inputs

| Item | Needed for | Status |
| --- | --- | --- |
| Approve the first `git push` to public repo `cuneytbozok/ustaplan` | M0.1 | Done (approved 2026-10-17) |
| Create the Supabase **dev** project (or approve creating it via connector); provide the DB password for `supabase link` | M0.3 | Done: `xytwwudbnykackuxfeif`, Ireland (accepted, plan T-10) |
| Create or connect the Vercel project to GitHub; paste the secret env vars | M0.4 | Done: project `ustaplan`, https://ustaplan.vercel.app |
| Set Vercel Function Region to Dublin (`dub1`), near the Ireland DB (default is `iad1`) | before M1.3 | Done: owner set Dublin (2026-10-17) |
| Approve each migration push to dev | M1.1 ✓, M2.1, M3.1, M5.1, M5.3, M5.8 | Ask per task (M1.1 approved 2026-10-17) |
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
| M1.5 | Ayarlar: profile + password change | In Progress | `/ayarlar` (Profil, Şifre, Çıkış yap) + Ayarlar entry in the profile sheet. `actions/settings.ts`: `updateProfile` (zod, E.164 via `normalizePhone`, `getClaims` re-check, RLS update, `refresh()`), `changePassword` (zod: min 8, confirm match, new ≠ current; current verified with a throw-away non-persisting client, then signed out; `updateUser` on the user's session). Shared `FormField`/`FormStatus`, `ActionResult` type. Labels: name/business "Müşteri de görür.", phone "Müşterilerin bu numarayı görür." **Local 360 px as B:** invalid phone → field error, nothing saved; valid save → "Bilgilerin kaydedildi.", persists after reload (phone shown 0532 000 00 02, stored E.164); wrong current password → "Mevcut şifren hatalı." and fields cleared; mismatch → "Şifreler aynı değil."; valid change → "Şifren değiştirildi.", session kept. **Against Supabase:** B's old password → `invalid_credentials`, new → OK (`.env.local` updated). Logout from Ayarlar works; no server errors. typecheck, lint, env-free build pass. **Added (owner-approved plan change T-11):** the owner saw the iOS home-screen app open every tab except the saved one in an in-app browser (no manifest → iOS can't know the app's scope). Added `src/app/manifest.ts` (`scope: "/"`, `start_url: /bugun`, standalone, theme/background colours), `src/app/apple-icon.png` (180), `public/icons/icon-{192,512}.png` (any + maskable), `appleWebApp` metadata (title "UstaPlan"). Locally: manifest and icons 200 for signed-out visitors (outside the proxy); head has `manifest`, `apple-touch-icon` and `apple-mobile-web-app-*`. Build passes. **Remaining:** deploy; the owner removes and re-adds the home-screen app, checks all tabs stay standalone, then smoke-tests Ayarlar (2026-10-18) |
| M1.6 | Customers + addresses (list, search, CRUD, detail, delete rule) | Pending | |
| M1.7 | `security-check.ts` v1 (RLS, anon, storage, workflow columns) | Pending | |

## M2 — Jobs, statuses, pricing, search, history · depends on M1
| ID | Task | Status | Verification / notes |
| --- | --- | --- | --- |
| M2.1 🔑 | Migration `jobs` (`create_job`, `change_job_status`, `jobs_log_changes`) → dev (approval) | Pending | |
| M2.2 | Yeni iş form (recent chips, inline customer, Diğer detaylar) | Pending | |
| M2.3 | İşler list: filters + search | Pending | |
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
