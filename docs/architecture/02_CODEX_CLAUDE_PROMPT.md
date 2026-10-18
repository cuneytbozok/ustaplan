# Implementation prompt — Paste into Codex or Claude Code

> **Status (2026-10-17):** Supporting document. Where it conflicts with the product spec (v1.5) or [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md), those win. In particular: Web Push is **part of the MVP**; work proceeds milestone by milestone after plan approval rather than "start coding immediately"; the share-link base URL comes from `APP_BASE_URL`.

You are a senior full-stack TypeScript engineer and an expert in clean, mobile-first product design. **Build a complete, runnable MVP** for a Turkish tradesperson job-management PWA, named **UstaPlan**.

Read [`01_PRODUCT_AND_TECH_SPEC.md`](../product/01_PRODUCT_AND_TECH_SPEC.md) thoroughly. Use [`03_SCHEMA_STARTER.sql`](03_SCHEMA_STARTER.sql) as the data-model and RLS foundation, and [`04_DESIGN_PREVIEW.html`](../design/04_DESIGN_PREVIEW.html) as the visual reference (not the production source). If anything conflicts, the product specification takes precedence. Do not drop features to produce a superficial demo.

## Non-negotiables

- **Product:** Tradesperson-centered job notebook, not a marketplace or a full CRM. Customer does NOT create an account; customers access **only one job** from a signed secret link.
- **Tech:** Next.js App Router, TypeScript strict, Tailwind CSS, Supabase Auth + Postgres + private Storage, `@supabase/ssr`, Next.js route handlers / server actions, PWA deployable on Vercel.
- **UI language:** Turkish throughout; TRY prices, Turkish 24h time, `Europe/Istanbul`. Application name `UstaPlan`.
- **Authentication:** No public signup. Admin creates individual users through a safe local script with server-side Supabase admin API; users can log in, log out, change their password within settings. No SMTP or email reset flow: show concise manual-reset instructions. Provide safe admin create/reset scripts that do not leak credentials to logs or frontend.
- **Main artisan tabs:** Bugün / Takvim / İşler / Müşteriler. Settings accessible from header. Fast `+ Yeni iş` accessible with a primary CTA. An artisan can create a job **without an appointment**.
- **Jobs:** Customer, optional address, description, status, optional price + show-price toggle, private note, photos, private audio notes, multiple appointments. Pending/material-waiting jobs remain discoverable. Customer search + job search. Existing customer may have many addresses/jobs.
- **Appointments:** In-app calendar, default duration 60 min, overlap detection shown **only to artisan** as warning, never mandatory blocking. Appointment and Job are separate entities. Date-change request/approval/counter-offer flow; until finalized original appointment stays valid; ensure atomic commit.
- **Customer:** Signed link `/t/{jobId}.{signature}`, no login or SMS. Show only public job details; never show customer's own address/phone, other jobs, artisan private notes/audio or artisan availability. Show artisan phone with call and `wa.me` quick links. Customer can request reschedule, accept artisan counteroffer, directly cancel job with a REQUIRED reason (`İhtiyacım kalmadı`, `Fiyat yüksek geldi`, `Fikrimi değiştirdim`, `Başka bir ustayla anlaştım`, `Tarih uygun değil`, `Diğer`) and optional note; if other, note required.
- **Photos:** Artisan can upload images and decide whether to share them; customer can upload images for this job and delete ANY customer-uploaded image from this job link, but may not delete artisan-uploaded media. Customer can upload even after job completion (unless link is disabled). Compress client-side; validate server-side; keep Supabase buckets private. Audio notes are artisan-only, recorded without AI.
- **Link security:** HMAC-SHA256 signed job link bound to `jobId` and `share_version`; `share_enabled` to disable; rotate version to invalidate. Verify on every GET/POST/DELETE, rate limit customer mutations, no auth/service secrets on client. Return only a strictly whitelisted public DTO; `no-store`, `noindex`, `no-referrer` headers. RLS on all exposed DB tables, owner-scoped, enforce cross-table tenant ownership.
- **Notifications:** In-app notifications with unread badge for cancellations and reschedule requests; upcoming jobs/today reminders. (v1.4) Web Push is part of the MVP: immediate pushes for customer cancel / reschedule request / counter-offer accepted, scheduled pushes 1 h before appointments and a daily follow-up reminder via Supabase Cron; never claim delivery is guaranteed. No paid integrations.
- **WhatsApp:** Generate a prefilled `wa.me` message manually sent by artisan. Do not integrate WhatsApp Business API.
- **Quality:** Clean minimal design; no placeholder-only screens or dead buttons, no fake persistence, no inline API secrets, no unsanitized SQL, no misleading confirmation of an action that has not persisted. Provide useful loading/empty/error/toast states.

## Desired visual direction

Aim for a modern, restrained Turkish utility app: warm ivory `#F7F8F5` background, white cards, dark green-black `#1C2923` typography, muted `#68766E`, evergreen accent `#19745A`, subtle borders `#E5EAE5`, 16px corner radii, minimal shadows. Clear visual hierarchy, generous whitespace, Lucide icons, easy one-hand mobile usage. Avoid flashy gradients, dashboard clutter, giant KPI tiles, and generic template styling. Give the customer view a reassuring single-page receipt-like feel. Responsive, accessible, 44px touch targets. Render polished real Turkish copy rather than lorem ipsum. Use [`04_DESIGN_PREVIEW.html`](../design/04_DESIGN_PREVIEW.html) for visual intent, not as an implementation blueprint.

## Implementation sequence — execute, don't just describe

1. Initialize Next.js app with strict TS, Tailwind, lint, test harness and installable PWA basics. Read official/current Next.js and Supabase SSR docs before choosing current APIs; pin dependencies and include lockfile.
2. Implement Supabase session setup, protected routes, login/logout, password change and no-signup design. Add admin-only local provisioning & manual reset scripts (`scripts/create-artisan.*`, `scripts/reset-password.*`), documented in README; don't build an admin UI.
3. Finalize SQL migration from [`03_SCHEMA_STARTER.sql`](03_SCHEMA_STARTER.sql) including enums/checks, owner-safe FKs, RLS and private Storage buckets/policies. Add generated TS types and `.env.example`.
4. Implement working artisan CRUD: profile, customer+addresses, jobs, search, status, price visibility, notes, calendar and appointments, private photos/audio, job history/events, share link creation/rotation. Ensure cross-tenant access tests.
5. Implement customer signed-link GET, date request + artisan approval/counter + customer counter acceptance, job cancellation with reason, customer photo upload/deletion, safe public media delivery. Use DB transactions/RPC for multi-row state transitions; ensure retries are safe.
6. Build elegant responsive UX matching design tokens and screen flows, including functional camera/voice input, WhatsApp/call/map deep links, notifications, empty/error/loading states.
7. Add focused automated tests for tenant separation, signed-link tampering/revocation, customer photo ownership, status transitions, scheduling overlap, concurrency/idempotency and price privacy. Test in a mobile-width browser.
8. Run lint/typecheck/build/tests and fix failures. Provide deployment checklist for Supabase+Vercel, with no credential disclosure.

## Operational details to decide during build

- Adopt pragmatic atomic transition RPCs or transactions for cancellation, rescheduling and file metadata operations; do not perform fragile sequential DB writes that leave half-updated state.
- Customer public mutation operations run **server-side**, after HMAC validation; use tightly scoped DTOs.
- Use an `app_metadata`/server-trusted source for administrative roles if needed; never derive authorization from user-editable metadata.
- For share links prefer a deterministic server-side HMAC signature computed from `jobId:shareVersion` and a strong random `SHARE_LINK_SECRET`, stored only as a server environment variable. Constant-time compare; rotating version invalidates old URLs.
- When using signed Storage URLs, keep TTL short and understand temporary URL caching/revocation semantics. Never use public buckets for job photos/audio.
- Keep pilot costs minimal (Supabase Free and Vercel target). Explicitly note Vercel Hobby terms restrict commercial use; plan upgrades before business deployment.
- Prefer a small, maintainable component system; avoid speculative abstractions, state management frameworks, analytic SDKs and additional services.

## Definition of done

All 17 acceptance criteria in [`01_PRODUCT_AND_TECH_SPEC.md`](../product/01_PRODUCT_AND_TECH_SPEC.md) must be demonstrably met or flagged with concrete remaining blockers. Deliver a usable local project with actual DB reads/writes, scripts, migrations, tests, README and deployment instructions. Do not call a static prototype an MVP. At the end report (a) implemented items, (b) test commands and outcomes, (c) required user setup steps, (d) known limitations. If Supabase/Vercel credentials are unavailable, make honest distinctions between code completed and external integration not tested. Start coding immediately; ask questions only for absolute blockers, otherwise use the decisions in this pack.
