# CLAUDE.md — UstaPlan

Binding guidance for every Claude Code session (and human contributor) in this repository.

## Development workflow (permanent rules)

UstaPlan is built **one task at a time, on explicit instruction**. Tasks are the `Mx.y` items in [docs/PROGRESS.md](docs/PROGRESS.md), derived from the milestones in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

### When the owner says "start the next task" or "continue development"
1. Read `CLAUDE.md` (this file).
2. Read `docs/IMPLEMENTATION_PLAN.md`.
3. Read `docs/PROGRESS.md`.
4. Read `docs/HANDOVER.md` if it exists.
5. Verify the real state: inspect the relevant files, `git status`, and `git log --oneline -15`. If the trackers and the code disagree, trust the code, then correct the trackers and say so.
6. Pick the next task: the first task that isn't Completed and whose dependencies are Completed.
   **If a task is In Progress or was interrupted, resume it.** Don't start another task.
7. Implement **only that one task**, then do its lightweight verification (see "Verification" below).
8. **Don't** start the next task or milestone automatically.
9. Before finishing, update `docs/PROGRESS.md` (status, verification evidence) and rewrite `docs/HANDOVER.md`.
10. Stop and give a concise completion summary: what changed, how it was verified, what's next. Wait for instructions.

### Rules
- One task per explicit instruction. Never auto-start the next one.
- Follow the approved plan. If a task reveals that the plan is wrong or incomplete, stop and propose the change; don't silently diverge.
- Mark a task **Completed** only after its acceptance criteria are verified and the checks pass. If tests or criteria fail, the task stays **In Progress** (or **Blocked**) and the failure is recorded.
- Planned is not implemented. PROGRESS.md records only verified reality.
- Make a git commit for each completed task (message `M3.2: <summary>`, with the attribution trailer from the session instructions). **Push to GitHub only when the owner asks or has approved it.**
- Never overwrite, reset, stash away or discard uncommitted work from an earlier session. Look at it, describe it in the summary, and continue from it.
- Keep docs in sync with the implementation (plan, DATA_MODEL, README, this file) as part of the task that changes the behaviour.
- Subagents are allowed for work inside the current task (searching, reviewing, parallel test writing), never to begin other tasks.
- If blocked (missing decision, credentials, failing external service), record the blocker in PROGRESS.md and HANDOVER.md and stop. Don't guess.
- External side effects need explicit owner approval each time: GitHub push (**which triggers a Vercel deploy**), creating or configuring Supabase or Vercel resources, **applying a migration to any Supabase project** (`supabase db push`), changing env vars or Vault secrets, sending anything. For 🔑 tasks, prepare everything locally, then ask.
- Avoid overengineering. Add no feature, dependency or abstraction the current task doesn't need.

### Task statuses
`Pending` · `In Progress` · `Completed` · `Blocked`. Exactly one task may be In Progress.

### HANDOVER.md
Rewrite it (don't append) at the end of every task: last completed task, current or interrupted task, files changed, key decisions, tests and results, known bugs and blockers, uncommitted changes, the exact next action, resume commands. Keep it to about one screen.

## Sources of truth (in order)
1. [docs/product/01_PRODUCT_AND_TECH_SPEC.md](docs/product/01_PRODUCT_AND_TECH_SPEC.md) v1.4: product behaviour and acceptance criteria AC1–AC19.
2. [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md): rules, state machines, milestones, decisions (§15).
3. [docs/architecture/DATA_MODEL.md](docs/architecture/DATA_MODEL.md): schema, grants, RPCs, cron. Migrations must match it.
4. [docs/architecture/02_CODEX_CLAUDE_PROMPT.md](docs/architecture/02_CODEX_CLAUDE_PROMPT.md): supporting only.
5. [docs/design/04_DESIGN_PREVIEW.html](docs/design/04_DESIGN_PREVIEW.html): visual intent; don't copy its code.
6. [docs/architecture/03_SCHEMA_STARTER.sql](docs/architecture/03_SCHEMA_STARTER.sql): historical reference; **never execute**.

If the docs conflict and the plan doesn't resolve it, ask the owner.

## Scope

**In scope (MVP):**
- Artisan login, logout and password change
- Customers with multiple addresses
- Jobs with 0..n appointments; derived and manual statuses; cancel; reopen (completed or cancelled)
- Day/week calendar with overridable conflict warnings
- Artisan photos (private/shared) and private voice notes
- Agreed and estimated price with change history; only the agreed price can be shown to customers
- Job history and audit events
- In-app inbox
- **Web Push**: immediate events, a reminder 1 h before each appointment, a daily follow-up
- Signed customer link: view, cancel with a mandatory reason, reschedule request and counter-offer, photo upload/delete
- KVKK notice at `/gizlilik`
- WhatsApp, call and map deep links
- Installable PWA

**Out of scope, never add:**
- Public signup, customer accounts, OTP, SMS or email flows, SMTP or any automated password reset, admin UI
- Marketplace, payments, invoicing, accounting, inventory, multi-staff
- AI or transcription
- WhatsApp Business API or automated messages
- Route optimisation, analytics, dashboards, offline data sync
- Vercel Cron, Edge Functions, extra paid services

## Architecture decisions
- **Next.js App Router + TypeScript strict**, `src/` layout. Server Components by default; client components only for interactivity.
- **Artisan writes:** Server Actions using the user-scoped Supabase client with plain RLS CRUD. **Only the 9 multi-row workflows in DATA_MODEL §4** are Postgres RPCs (one transaction each, row-locked, idempotent). Don't add RPCs where secure CRUD is enough.
- **Customer endpoints:** `src/app/t/[token]` and `src/app/api/t/[token]/…`. Every request (including media GETs) verifies the HMAC token. Then the server-only admin client calls public RPCs that re-check `share_enabled` and `share_version` under lock. Responses use the allowlisted `CustomerJobView` DTO only.
- **Share links:** `APP_BASE_URL + /t/<jobId>.<HMAC(SHARE_LINK_SECRET, jobId:share_version)>`. Never hard-code domains.
- **Auth:** Supabase email/password via `@supabase/ssr`. Authorise with server-verified claims (`getUser()`/`getClaims()`), never `getSession()` or raw cookies. Signup is disabled. The admin uses local scripts.
- **Keys:** only the publishable key and the VAPID public key reach the browser. `SUPABASE_SECRET_KEY`, `SHARE_LINK_SECRET`, `CRON_SECRET` and `VAPID_PRIVATE_KEY` live in `server-only` modules.
- **Storage:** private buckets, path `<owner>/<job>/<media>.<ext>`. Images are prepared in the browser (HEIC → JPEG, ≤1600 px, ≤2 MB, EXIF/GPS removed). The server validates magic bytes. Artisans view media through 1 h signed URLs; customers through the token-verified media proxy.
- **Workflow data** (`jobs.status`, `share_*`, `cancelled_*`, appointments, requests, events) is written only by RPCs and triggers. **No job deletion in the app.**
- **Notifications:** the `notifications` table is both inbox and push outbox (dedupe key; claimed with a conditional update). Immediate pushes go out via `after()` in the request. One **Supabase Cron** job (`pg_cron` + `pg_net`, every 5 min, bearer `CRON_SECRET` from Vault) calls `/api/internal/dispatch`. That TypeScript endpoint creates reminders and the digest, sends and retries, and does the daily cleanup. `web-push` runs on Vercel.
- **Environments:** hosted Supabase **dev** project (fake data) from M0; a separate **prod** project only at M6.3. No Docker and no local Supabase. Phone testing uses the production `vercel.app` URL.
- **Time:** `timestamptz`, displayed and parsed in `Europe/Istanbul` with an explicit `timeZone`. **Money:** `numeric(12,2)` TRY via `Intl.NumberFormat('tr-TR')`.
- Small dependency list, pinned by lockfile. No ORM, state library, analytics or queue.

## Security rules (non-negotiable)
- RLS on every table; owner-scoped policies; composite FKs; `security definer` RPCs assert ownership or the share version themselves; `anon` has nothing.
- The customer page never exposes the customer's phone or address, other jobs, notes, audio, private photos, the **estimated price**, or the artisan's calendar.
- Public GETs are strictly read-only (WhatsApp previews). POST/DELETE need an explicit user action, an `Origin` check, zod validation, rate limits, and an audit event.
- Public routes send `no-store`, `no-referrer` and `noindex`; no third-party scripts; no OG tags with job data.
- Never log tokens, phone numbers, addresses or passwords. Seeds and tests use fake data only.
- **Public repository:** never commit secrets, `.env*` (except `.env.example`), Vault values or real data.
- Compare signatures and secrets with `timingSafeEqual`. Invalid, revoked and unknown links all look the same.

## Coding conventions
- Code, identifiers, comments, commits and docs are in English. UI copy and routes are in Turkish (`/bugun`, `/takvim`, `/isler`, `/musteriler`, `/ayarlar`, `/bildirimler`, `/giris`, `/gizlilik`).
- Tone: the artisan app uses *sen* ("Sadece sen görürsün"); the customer page and privacy notice use *siz*.
- DB values are English codes; Turkish labels live in `src/lib/domain/labels.ts`. Push and inbox copy lives in `src/lib/push/render.ts`.
- Files are kebab-case; components PascalCase.
- zod validation at every server boundary. Server Actions return `{ ok: true, data } | { ok: false, error }` with Turkish messages.
- No success feedback before the write has persisted. No dead buttons, placeholders or fake persistence.
- Customer-visible artisan fields are labelled in the form ("Müşteri de görür" / "Müşterilerin bu numarayı görür").
- `src/types/database.ts` is generated; regenerate it after every migration.
- Migrations are created with `npx supabase migration new <name>` (CLI timestamped filenames; never invent names like `0001_…`), hand-written, forward-only, small, never edited after being applied, and contain no secrets or environment URLs. Use the Supabase CLI without Docker (`migration new`, `link`, `db push`, `gen types`). Never use `db diff`, `db pull`, `start` or `test db`. Re-run `scripts/security-check.ts` after every applied migration.
- Check current official docs before using Next.js or Supabase APIs (`proxy.ts`, new key names, `getClaims()`, `after()`).

## Design system
Tokens: `background #F7F8F5`, `surface #FFFFFF`, `ink #1C2923`, `muted #68766E`, `primary #19745A`, `primary-soft #EAF4EF`, `border #E5EAE5`, `warning #BA7B2C`, `danger #B64B4B`. System sans stack; 8 px spacing; card radius 14–18 px; borders over shadows; Lucide icons. Brand: "UstaPlan" wordmark; icon is a white "U" on `#19745A`.
- Four tabs (Bugün, Takvim, İşler, Müşteriler). Bell and profile sheet in the header. `+ Yeni iş` FAB on every tab.
- One dominant CTA per screen. Touch targets ≥ 44 px (primary ≥ 48 px). Correct at 360 px. Safe areas respected.
- Status shown with colour **and** text. Progressive disclosure ("Diğer detaylar"). Creating a job for an existing customer takes ≤ 4 interactions.
- Every list has a skeleton, a helpful empty state and error + retry.
- Avoid KPI tiles, charts, gradients, dense tables, decorative animation and generic SaaS styling.

## Verification (lightweight) and definition of done
- **Every task:** `npm run typecheck` and `npm run lint`, plus a manual smoke test of the feature (on the phone via the deployed URL once M0.4 is done).
- **`npm run build`:** only at milestone ends, before every push/deploy, and after significant changes (dependencies, config, proxy/routing, route handlers, service worker). Skip it for trivial tasks.
- **Env vars:** validated lazily per feature through the `lib/env.ts` getters. Never add import-time or build-time validation that would make the build or earlier features depend on later secrets (VAPID, cron).
- **Automated tests, only for critical logic:** `share-link`, `scheduling`/time, `public-dto` (Vitest). Don't add tests for minor utilities or UI components unless a bug proves they're needed.
- **Security checks (never skip):** `scripts/security-check.ts` against the dev project with two fake accounts covers cross-user RLS, anon/unauthorised access and mutations, storage restrictions, link validation and revocation, customer data exposure, and cancel/reschedule consistency. Extend it in the tasks named in the plan.
- **No** Docker, pgTAP, Playwright suites, Lighthouse targets or CI pipelines.
- **Completed** means: the feature works, its relevant checks pass, and no critical issue remains. Anything not verified (e.g. no iPhone available) is written down explicitly in PROGRESS.md and HANDOVER.md.
- Never weaken security controls, ownership checks or atomic operations to save time.
