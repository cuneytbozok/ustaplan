# UstaPlan

A mobile-first job and appointment app for independent tradespeople (*usta*) in Turkey. Its job is to make sure appointments, unfinished jobs and customer requests are never forgotten.

- **Tradespeople** sign in to an installable PWA. They keep customers, jobs, appointments, photos, voice notes and prices in one place, and get push reminders.
- **Customers** never create an account. Each job has a private link (`/t/<token>`) where the customer follows that one job, uploads photos, asks for a different date, or cancels with a reason.
- **Pilot:** 1–2 tradespeople, free-tier infrastructure, Turkish UI, `Europe/Istanbul`, TRY.

> **Status:** Planning is complete and the plan is approved (v3.1); implementation has not started. Development proceeds **one task at a time** on explicit instruction. Current state: [docs/PROGRESS.md](docs/PROGRESS.md) · how to resume: [docs/HANDOVER.md](docs/HANDOVER.md).

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS · shadcn/ui (trimmed) · Supabase (Postgres + RLS, Auth, Storage, Cron, Vault) · Vercel · PWA with Web Push (VAPID).

Hosting: **Vercel Hobby is for non-commercial testing only.** Before any commercial use, including a pilot that counts as commercial, the project must move to an appropriate plan. Supabase Free is used for the initial pilot.

## Documentation

| Path | What it is | Authority |
| --- | --- | --- |
| [docs/product/01_PRODUCT_AND_TECH_SPEC.md](docs/product/01_PRODUCT_AND_TECH_SPEC.md) | Product, UX and architecture spec v1.4 (Turkish) | **Primary source of truth** |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | v3.1 fast path: architecture, rules, milestones M0–M6 (37 tasks), verification, risks, decisions | **Approved plan** |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Task tracker: status of every milestone task | Live state |
| [docs/HANDOVER.md](docs/HANDOVER.md) | What the next session needs to continue | Live state |
| [docs/architecture/DATA_MODEL.md](docs/architecture/DATA_MODEL.md) | Target schema, RLS, RPCs, cron, retention; reconciliation with the starter | Binding for migrations |
| [docs/architecture/02_CODEX_CLAUDE_PROMPT.md](docs/architecture/02_CODEX_CLAUDE_PROMPT.md) | Original implementation prompt | Supporting |
| [docs/architecture/03_SCHEMA_STARTER.sql](docs/architecture/03_SCHEMA_STARTER.sql) | Original starter schema | Reference only; never executed |
| [docs/design/04_DESIGN_PREVIEW.html](docs/design/04_DESIGN_PREVIEW.html) | Interactive visual prototype | Visual reference |
| [docs/setup/05_SETUP_CHECKLIST.md](docs/setup/05_SETUP_CHECKLIST.md) | Supabase / Vercel / device checklist | Operational |
| [docs/setup/PRIVACY_AND_DATA_REQUESTS.md](docs/setup/PRIVACY_AND_DATA_REQUESTS.md) | KVKK notice draft and manual data-request process | Operational |
| [CLAUDE.md](CLAUDE.md) | Conventions and the task-by-task workflow | Binding |

Precedence when documents disagree: spec v1.4 → IMPLEMENTATION_PLAN → DATA_MODEL → implementation prompt.

## Notifications: what to expect

Push reminders work on Android browsers and on iPhones **only when UstaPlan is added to the Home Screen (iOS 16.4+)**. Delivery depends on device permissions, connectivity and the operating system, so it can't be guaranteed. The in-app inbox and the Bugün screen are always the reliable source.

## Local development

Not available yet. M0 adds the commands and environment variables (IMPLEMENTATION_PLAN §11). Development uses plain `npm run dev` against a hosted Supabase **dev** project. There's no Docker or local database. Real pilot data lives only in a separate **prod** project created at pilot launch.

## Repository

`github.com/cuneytbozok/ustaplan` is a **public** repository. Never commit secrets, `.env.local`, Vault values or real customer data.
