# UstaPlan — Implementation Plan (MVP)

**Version:** 3.2 · 2026-10-18 · **Status:** ✅ approved. Planning is complete; no further architecture reviews unless an implementation blocker appears.

**v3.2 (owner, 2026-10-18):** owner-only **admin panel** at `/admin` added before the pilot (spec v1.5 §2.1, decisions A-1…A-5 in §15, §4.1). New tasks M6.1–M6.4; the former M6.1–M6.3 are now M6.5–M6.7. 41 tasks.

**v3.1 corrections:** CLI-generated timestamped migration names · per-feature env validation · auth accounts created before login (M1.2 ↔ M1.3 swapped) · production builds only at milestone boundaries, before deploys, or after significant changes
**Goal:** get a working, secure UstaPlan MVP on a real HTTPS URL as early as possible and test it on a real phone throughout development. **The product scope and design direction are unchanged.** Only the process is lighter.

**Inputs:** [Spec v1.5](product/01_PRODUCT_AND_TECH_SPEC.md) (primary) · [DATA_MODEL.md](architecture/DATA_MODEL.md) (schema) · [Privacy & data requests](setup/PRIVACY_AND_DATA_REQUESTS.md) · [Setup checklist](setup/05_SETUP_CHECKLIST.md) · [Design preview](design/04_DESIGN_PREVIEW.html) · [Implementation prompt](architecture/02_CODEX_CLAUDE_PROMPT.md) (supporting) · [Schema starter](architecture/03_SCHEMA_STARTER.sql) (historical)

**Priorities:** simplicity → correctness → security → mobile usability → maintainability → low cost.
**Workflow:** one task at a time on explicit instruction ([CLAUDE.md](../CLAUDE.md)); task status lives in [PROGRESS.md](PROGRESS.md), session state in [HANDOVER.md](HANDOVER.md).

### What changed from v2
| Removed / changed | Replacement |
| --- | --- |
| Docker, local Supabase stack | Hosted **Supabase Free dev project**; Supabase CLI over the network (`link`, `db push`, `gen types`), no Docker |
| pgTAP, Playwright suites, device matrices, Lighthouse targets, GitHub Actions CI | typecheck + lint + build, manual phone smoke tests, a few Vitest tests for critical logic, one **security check script** |
| Deployment at M11/M16 | Vercel + Supabase in **M0**; the phone tests the HTTPS URL from the first feature on |
| 17 milestones, 70+ tasks | **7 milestones, 37 tasks** (41 since v3.2) |
| ~20 RPCs | **9 RPCs**; plain RLS CRUD everywhere else; reminder/digest logic in one TypeScript endpoint |

---

## 0. Owner decisions (still valid)

- **Q1:** The name is **UstaPlan** everywhere.
- **Q2:** No automated password recovery. The login page says "Şifrenizi unuttuysanız yöneticinizle iletişime geçin." The admin resets passwords manually.
- **Q3:** Use the `vercel.app` domain for now. Links are built from `APP_BASE_URL`, never hard-coded, and a future domain change keeps old links working (§11.4).
- **Q4:** Vercel Hobby (non-commercial only) + Supabase Free. Move to an appropriate plan before any commercial use.
- **Q5:** A Turkish KVKK notice at `/gizlilik`, linked from the customer page, plus a manual deletion process.
- **Web Push is MVP:** immediate (customer cancels, reschedule request, counter accepted), 1 hour before each appointment, a daily follow-up; real-device verification.
- The **estimated price is never public**; there's a basic price history; completed jobs can be reopened; customers reschedule the next scheduled appointment only; photo uploads give in-app notifications only.
- HEIC support, browser-side conversion, compression and EXIF/GPS removal; server-side format validation; short-lived signed URLs (artisan) and a token-verified proxy (customer).

---

## 1. Architecture

```
 Phone (artisan PWA) ─┐                 ┌──────── Vercel Hobby (fra1) ────────┐
                      ├── HTTPS ───────►│ Next.js App Router                  │
 Phone (customer) ────┘                 │  • (app) pages + Server Actions ────┼──► Supabase (user session, RLS)
                                        │  • /t/[token] + /api/t/* ───────────┼──► verify HMAC → admin client → public RPCs
                                        │  • /api/internal/dispatch ◄─────────┼─── Supabase Cron (pg_cron + pg_net, every 5 min)
                                        │  • web-push ────────────────────────┼──► Apple / Google push services
                                        └─────────────────────────────────────┘
 Supabase Free (Frankfurt): Postgres + RLS · Auth · private Storage · Cron · Vault
```

| Concern | Choice |
| --- | --- |
| App | Next.js App Router, TypeScript strict, Server Components by default |
| UI | Tailwind CSS v4 tokens, shadcn/ui only where it saves work (Sheet, Dialog, Switch, Tabs), Lucide, `sonner` toasts |
| Data | `@supabase/supabase-js` + `@supabase/ssr`; generated types; no ORM |
| Writes | Server Actions with the user session (RLS). The 9 RPCs exist only for multi-row workflows (DATA_MODEL §4). |
| Customer endpoints | Route Handlers; HMAC verified on every request; admin client; allowlisted DTO |
| Validation | `zod` at server boundaries |
| Time | `Intl` with an explicit `Europe/Istanbul` + `@date-fns/tz` for wall-time ↔ UTC |
| Images | Browser-side canvas pipeline; `heic2any` lazy-loaded only if the browser can't decode HEIC |
| Push | Service worker + Push API + VAPID; `web-push` on Vercel; subscriptions in Supabase |
| Scheduling | Supabase Cron → one dispatcher endpoint. No Vercel Cron, no queues. |

**Dependencies:** next, react, react-dom, @supabase/supabase-js, @supabase/ssr, zod, date-fns + @date-fns/tz, lucide-react, sonner, web-push, heic2any (lazy), shadcn/Radix primitives as used. Dev: typescript, eslint, vitest, tsx, supabase (CLI).

---

## 2. Directory structure

```
ustaplan/
├── README.md · CLAUDE.md · .env.example · package.json · package-lock.json · next.config.ts
├── docs/
│   ├── IMPLEMENTATION_PLAN.md · PROGRESS.md · HANDOVER.md
│   ├── product/01_PRODUCT_AND_TECH_SPEC.md
│   ├── architecture/DATA_MODEL.md · 02_CODEX_CLAUDE_PROMPT.md · 03_SCHEMA_STARTER.sql
│   ├── design/04_DESIGN_PREVIEW.html
│   └── setup/05_SETUP_CHECKLIST.md · PRIVACY_AND_DATA_REQUESTS.md · RUNBOOK.md (M6)
├── supabase/
│   ├── config.toml
│   ├── migrations/            # hand-written, forward-only; no secrets
│   └── seed-dev.sql           # fake data for the DEV project only
├── scripts/                   # admin-only, run locally with tsx
│   ├── create-artisan.ts · reset-password.ts · create-admin.ts (M6.2)
│   ├── security-check.ts      # two-account RLS / link / storage checks against DEV
│   ├── delete-customer-data.ts · export-customer-data.ts · backup.sh   (M6)
│   └── vault-secrets.sql.example
├── public/  icons/ · sw.js
├── src/
│   ├── proxy.ts
│   ├── app/
│   │   ├── layout.tsx · globals.css · manifest.ts · not-found.tsx · error.tsx
│   │   ├── giris/ · gizlilik/ · cevrimdisi/
│   │   ├── (app)/layout.tsx + bugun/ takvim/ isler/ isler/yeni/ isler/[id]/ musteriler/ musteriler/[id]/ bildirimler/ ayarlar/
│   │   ├── admin/ (M6.2–M6.4: layout, page, ustalar/, ustalar/[id]/, mfa/)
│   │   ├── t/[token]/page.tsx
│   │   └── api/
│   │       ├── t/[token]/media/[mediaId]/route.ts · photos/route.ts · photos/[mediaId]/route.ts
│   │       ├── t/[token]/cancel/route.ts · reschedule/route.ts · reschedule/accept/route.ts
│   │       └── internal/dispatch/route.ts
│   ├── actions/               # one file per domain
│   ├── components/            # ui/ shell/ common/ jobs/ appointments/ calendar/ customers/ media/ notifications/ public/
│   ├── lib/
│   │   ├── env.ts · supabase/{server,browser,admin}.ts
│   │   ├── share-link.ts · public-job.ts (DTO) · push.ts (render + send + dispatch)
│   │   ├── domain/            # labels, job-status, scheduling, phone, whatsapp, money, time, search-fold
│   │   ├── admin/             # auth (requireAdmin), accounts, stats — server-only (M6.2–M6.4)
│   │   └── media/             # prepare-image.ts (client), sniff.ts (server)
│   └── types/database.ts      # generated
└── tests/                     # only: share-link, scheduling/time, public DTO allowlist
```

Fewer files are fine. Don't split a module until it hurts.

---

## 3. Data model

See **[DATA_MODEL.md](architecture/DATA_MODEL.md)**. It covers tables, checks, grants, the 9 RPCs, the trigger, storage, cron, retention, and the reconciliation with the starter schema. Migrations are created with `npx supabase migration new <name>`, which produces `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`; the timestamp is the CLI's, never hand-written. They're added per milestone:

| Migration name (`migration new …`) | Task | Contents |
| --- | --- | --- |
| `core` | M1.1 | All tables, checks, `fold_tr`, search keys, `touch_updated_at`, grants, RLS, storage buckets and policies |
| `jobs` | M2.1 | `create_job`, `change_job_status`, `jobs_log_changes` trigger |
| `appointments` | M3.1 | `save_appointment`, `close_appointment` |
| `customer_cancel` | M5.1 | `public_cancel_job` |
| `reschedule` | M5.3 | `public_request_reschedule`, `public_withdraw_request`, `public_accept_counter`, `respond_to_request` (+ internal `reschedule_swap`) |
| `appointment_fk_deferred` | M5.3 (fix) | The two appointment self-reference FKs checked at commit, so job/account deletes cascade after a swap |
| `cron` | M5.8 | `pg_cron`/`pg_net` schedule using Vault secret names |
| `site_settings` | L.2 | `app_settings` (service role only) for the landing page's search visibility |

---

## 4. Authentication and authorization

- **Accounts:** Supabase email/password. **Signup is disabled** in the dashboard. There's no signup UI.
- **Admin scripts:**
  - `scripts/create-artisan.ts --email --name` creates the auth user (`email_confirm: true`) plus the profile, shows a generated temporary password once, and rolls back on failure.
  - `scripts/reset-password.ts --email` resets a password. The admin can also use the dashboard or, from M6.3, the admin panel.
  - `scripts/create-admin.ts --email` (M6.2) creates the single admin account (no `profiles` row) and sets `app_metadata.role = "admin"`; prints a temporary password once.
- **Login `/giris`:** email, password with show/hide, and the fixed forgot-password sentence.
- **Session:** `@supabase/ssr` cookies. `proxy.ts` refreshes the session on artisan routes and skips `/t`, `/api/t`, `/api/internal`, `/gizlilik` and static assets. Every Server Action re-checks the user with server-verified claims (`getUser()`/`getClaims()`).
- **Password change:**
  - Fields: current, new, confirm (minimum 8 characters).
  - The current password is verified with a throw-away non-persisting client, then `updateUser`.
  - Prefer a native Supabase current-password option if one exists at build time.
- **Logout:** deletes this device's push subscription, then signs out.
- **RLS:** owner-scoped on every table, column-level update grants, composite FKs; `anon` has nothing (DATA_MODEL §3).

---


### 4.1 Admin panel (`/admin`, v3.2)
- **Gate (`requireAdmin()` in `lib/admin/auth.ts`, server-only, `cache()`), on every page and every admin Server Action:** session via `getClaims()` → `app_metadata.role === "admin"` (only the service role can set `app_metadata`) → MFA assurance level `aal2`. No TOTP factor yet → enrollment page (QR, confirm a code); factor but `aal1` → challenge page. Anyone else → `notFound()` (404). `/admin` sends `noindex` and `no-store`.
- **Account:** one separate auth user with **no `profiles` row**, so RLS gives it no artisan data. `/giris` is shared: `signIn` sends an admin to `/admin`; the `(app)` layout sends an admin who lands there to `/admin`.
- **Data access:** reads and writes on the server through the existing admin client (`lib/supabase/admin.ts`). No RPC, no migration, no new dependency or chart library.
- **Actions** (zod, `{ok, data} | {ok, error}`, confirmation dialog each): create artisan, reset password (temporary password shown once, never logged or stored), deactivate (`ban_duration` via `auth.admin.updateUserById` + delete the artisan's `push_subscriptions`), reactivate (`ban_duration: "none"`). No delete. Account logic shared with the scripts in `lib/admin/accounts.ts`.
- **Figures** (TypeScript over admin-client queries; days and weeks in `Europe/Istanbul` via `lib/domain/time.ts`): jobs today / week / month vs the previous period; 12-week trend of jobs and new customers (CSS/SVG bars + table); active artisans 7/30 days (sign-in or activity); totals of artisans, customers, jobs by status, appointments; per-artisan counts; system health (push results 24 h, oldest pending, last sent, media count and storage). **Counts only:** no customer names, phones, addresses, notes, photos or job content.

## 5. Customer links

- **Token:** `<jobId>.<base64url(HMAC-SHA256(SHARE_LINK_SECRET, "ustaplan:job-link:v1:" + jobId + ":" + share_version))>`. URL = `APP_BASE_URL + "/t/" + token`.
- **Revoke:** `share_enabled=false`. **Regenerate:** `share_version + 1`. Both are effective immediately, because every request reads the current values.
- **Every request** (page, media, POST, DELETE): parse → load `share_enabled, share_version` → recompute → `timingSafeEqual`. Any failure returns the same 404 "Bu bağlantı geçersiz veya kapatılmış." Cancel and reschedule RPCs re-check the version under a row lock.
- **Allowlisted DTO** (`CustomerJobView`):
  - Artisan: display name, business name, phone.
  - Job: title and status.
  - The next scheduled appointment.
  - The open request state.
  - The agreed price, only if `show_price_to_customer`.
  - Photos (via the proxy URL) with a `canDelete` flag.
  - The customer's own notes (N-1).
  - Capability flags.

  **Never** the customer's phone or address, other jobs, the artisan's notes, audio, private photos, the estimate, or the calendar.
- **GETs are read-only** (WhatsApp previews). There's no OG data and the title is generic.
- **POST/DELETE:** explicit button + confirmation, `Origin` = `APP_BASE_URL`, zod, rate limits, and a `job_events` row with `actor_type='link_holder'`.
- **Headers** on `/t/*`, `/api/t/*`, `/gizlilik`: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`.
- **Rate limits:** ≤ 10 uploads per hour, ≤ 20 active customer photos, ≤ 10 reschedule requests per day, ≤ 20 active customer notes and ≤ 20 note writes per hour (N-1), per job. Photo limits are counted from `job_media` (the hourly one includes deleted uploads), so concurrent requests may overshoot by one or two. Cancel needs no counter: only the first call on an open job changes anything, and cancelling again requires the artisan to reopen the job.
- **Accepted risk (owner):** whoever holds an active link can perform its customer actions.

**Customer capabilities**

| Job state | Upload | Delete own-origin photo | Request reschedule | Accept / withdraw | Cancel | Own notes (N-1) |
| --- | --- | --- | --- | --- | --- | --- |
| unplanned | ✓ | ✓ | – | – | ✓ | ✓ |
| scheduled · in_progress · waiting_material | ✓ | ✓ | ✓ (next appointment) | ✓ | ✓ | ✓ |
| completed | ✓ | ✓ | – | – | – | read-only |
| cancelled | – | ✓ | – | – | – | read-only |
| link disabled/rotated | invalid page | | | | |

---

## 6. Photos and voice notes

- **Buckets:** private `job-images` (2 MB, jpeg/png/webp) and `job-audio` (4 MB). Path `<owner>/<job>/<media>.<ext>`. Storage policies allow owner + owned job only, and `anon` gets nothing (DATA_MODEL §6).
- **Browser preparation:** `createImageBitmap` (handles HEIC on Safari; lazy `heic2any` elsewhere), longest side ≤ 1600 px, JPEG quality stepped down until ≤ 2 MB. Re-encoding strips EXIF/GPS.
- **Artisan:**
  - Upload directly to Storage with the user session, then a Server Action registers the `job_media` row after checking path, size and type. Photos are private by default; the toggle is "Müşteriyle paylaş".
  - Delete: soft-delete the row, then remove the object. Orphans are cleaned up daily by the dispatcher.
  - Viewing uses signed URLs (1 h).
- **Customer:**
  - `POST /api/t/[token]/photos` (≤ 2 MB). The handler checks magic bytes, the job state and rate limits, then the admin client stores the object, inserts the row and adds the in-app notification. If the row insert fails, the object is removed.
  - Customers delete only `origin='customer'` media on that job. Viewing goes through the proxy.
- **Written notes (N-1):** `job_notes`, several per job. Artisan notes are private, added/edited/deleted on the job page (Server Actions, plain RLS CRUD; delete asks first; "Düzenlendi" after an edit). Customer notes come from the customer page (N.3) and are read-only for the artisan, shown in a separate "Müşteri notları" card.
- **Voice notes:** `MediaRecorder` (`audio/mp4` on iOS, `webm/opus` elsewhere), 60 s cap, artisan-only, played with a native `<audio>` player. Unsupported devices see an explanation.

---

## 7. Job and appointment rules

**Job statuses:** `unplanned · scheduled · in_progress · waiting_material · completed · cancelled`. "Open" = the first four.

| Rule | Behaviour |
| --- | --- |
| J1 | The artisan chooses only Devam ediyor / Parça bekleniyor / Tamamlandı / İptal (`change_job_status`). `unplanned` and `scheduled` follow from appointments. |
| J2 | Saving an appointment on an `unplanned` job → `scheduled`. `in_progress`/`waiting_material` keep their status for follow-up visits. |
| J3 | Last scheduled appointment **cancelled** → `scheduled` becomes `unplanned`. Last one **completed** → `scheduled` becomes `in_progress`. Completing a visit never completes the job. |
| J4 | Complete job: future scheduled appointments are cancelled (after a confirmation listing them); open requests are closed. |
| J5 | Reopen from `completed` or `cancelled` → `unplanned`. No appointment is created, and the same link works again. |
| J6 | Cancel (customer or artisan): scheduled appointments with `ends_at > now()` → cancelled; open requests → closed; cancellation fields set; event; customer cancellations also notify + push. Not allowed on completed or cancelled jobs; repeat calls are idempotent. |

**Appointment statuses:** `scheduled → completed | cancelled | superseded`. Terminal states never change. Appointments can't be added to closed jobs.

**"Takip gerekenler":** open jobs without a future scheduled appointment, plus overdue visits (`scheduled` and `ends_at < now()`), with quick actions "Tamamlandı" / "Yeniden planla". Always visible on Bugün.

---

## 8. Conflicts and rescheduling

**Conflict query:** an ordinary select, `scheduled` appointments of this artisan where `starts_at < newEnd and ends_at > newStart`, excluding the one being replaced. Back-to-back visits are fine.
- The picker shows a `ConflictCard` with the clashing job and a suggested slot: the first free gap of the same length on that day between 08:00 and 20:00, otherwise the next day from 09:00.
- Saving is **never blocked**; the button reads "Yine de kaydet".
- Customers never see availability.

**Defaults:** duration 60 min (chips 30/60/90/120/other, range 15–480). Date chips Bugün / Yarın / Tarih seç. Time step 15 min.

**Negotiation**

| From | To | Who |
| --- | --- | --- |
| — | pending_artisan | Customer requests a new time for the next appointment (future time only; same duration) → push |
| pending_artisan | accepted / rejected / pending_customer | Artisan approves (atomic swap) / rejects / counters (conflict card shown) |
| pending_customer | accepted | Customer accepts the counter (rejected if the time has passed) → push |
| pending_customer | withdrawn + new pending_artisan | Customer sends another request (one transaction) |
| any open | withdrawn | Customer |
| any open | closed | System: job cancelled/completed, or the appointment changed by the artisan |

**Atomic swap:** lock → verify → new appointment `scheduled`, old one `superseded`, request `accepted` → event + notification. Repeat calls return the same result. A partial unique index allows only one open negotiation per appointment.

---

## 9. Notifications and Web Push

| Event | In-app | Push |
| --- | --- | --- |
| Customer cancelled | ✓ | immediate |
| Reschedule requested | ✓ | immediate |
| Counter accepted | ✓ | immediate |
| Request withdrawn | ✓ | immediate, replaces the request's push (T-15) |
| Customer photos (one item per job per day) | ✓ | – |
| Appointment in 1 hour | – | scheduled (±5 min) |
| Daily follow-up at 08:00 (only if something needs attention) | – | scheduled |

- **Inbox:** bell with unread count in the header → `/bildirimler`. Mark read individually or all at once. The page refreshes on focus.
- **Subscriptions** (Settings → Bildirimler):
  - On iPhone without Home Screen install: show the install steps only, with no permission prompt.
  - Otherwise: "Bildirimleri etkinleştir" asks permission on tap, subscribes, and inserts a `push_subscriptions` row.
  - "Bu cihazda kapat" removes it. "Test bildirimi gönder" checks delivery.
  - Multiple devices per user. Logout removes the current device.
- **Service worker** (`sw.js`): `push` shows the notification with `tag` = dedupe key; `notificationclick` focuses or opens the job; offline fallback page only. It never caches HTML or API responses and ignores `/t/*`.
- **Sending** (`lib/push.ts`, a single module):
  - **Immediate:** the customer-action route commits the RPC (which inserts the notification as `pending`), responds, then `after()` claims and sends that notification. This doesn't depend on cron.
  - **Scheduled:** Supabase Cron calls `POST /api/internal/dispatch` every 5 min with the bearer secret from Vault. The endpoint creates due reminders and today's digest (dedupe keys prevent duplicates), sends everything pending, and retries failures up to 3 times. It also does the daily storage cleanup.
  - **Claim:** a conditional update (`push_status in ('pending','failed')` → `sending`). Two runners can't send the same notification.
  - **Invalid subscriptions:** a 404/410 deletes the row; 5 consecutive failures delete it too.
- **Honest limits** (shown in Settings and the README):
  - Delivery isn't guaranteed.
  - iOS needs a Home Screen PWA on 16.4+.
  - Reminder precision is ±5 min.
  - No reminder for an appointment created less than 60 min before it starts.

---

## 10. Mobile UX

- **Navigation:** bottom tabs Bugün · Takvim · İşler · Müşteriler. Header with bell (badge) and profile sheet (Ayarlar, Çıkış). `+ Yeni iş` FAB on every tab. Detail and form pages have a back link and a sticky action bar. Secondary flows use bottom sheets.
- **Fast job creation:**
  - FAB → tap the customer search → tap a recent customer (or type a name/phone and tap the match) → type "Yapılacak iş" → "İşi kaydet" (U-1; from a customer page the customer is preselected).
  - From a customer page it takes 3.
  - Scheduling, address, prices, note and photos are optional ("Randevu planla" switch, "Diğer detaylar").
  - After saving, the app offers to send the link via WhatsApp.
- **Screens:**
  - Giriş.
  - Bugün: summary line, pending requests, today's appointments, Takip gerekenler.
  - Takvim: day and week.
  - İşler: search + Açık / Tamamlanan / İptal.
  - Yeni iş.
  - İş detayı: status, customer actions, appointments, request card, price + history, photos, notes (Notlarım: written + voice; Müşteri notları), history, link.
  - Müşteriler and customer detail.
  - Bildirimler.
  - Ayarlar: profile, notifications, password, install guide, logout.
  - Customer page: receipt-like, *siz* tone, "Kişisel verileriniz" link.
  - Invalid link.
  - Gizlilik.
- **Design:**
  - Spec tokens, system font, borders over shadows.
  - Touch targets ≥ 44 px; works at 360 px; safe areas respected.
  - Status shown with colour + text; 16 px inputs.
  - Turkish price input (`2.500,50`); E.164 phones; `wa.me` links.
  - No KPI tiles, charts, gradients or decorative animation.
  - Brand: "UstaPlan" wordmark; icon is a white "U" on `#19745A`.

---

## 11. Environments and deployment

### 11.1 Environments
| Environment | Supabase | Vercel | Data |
| --- | --- | --- | --- |
| Local dev (`npm run dev`) | **ustaplan-dev** (Free, Ireland `eu-west-1`, see T-10) | — | fake only |
| Dev/test URL (M0 → M6) | ustaplan-dev | Production deployment on `<name>.vercel.app` | fake only |
| Pilot (M6.7 →) | **ustaplan-prod** (second free project) | Same production deployment, env vars switched | real |

- Supabase Free allows **two active projects per organisation**, enough for dev + prod. Development data never enters the pilot project.
- Phone testing uses the **production** `vercel.app` domain. Hobby's standard deployment protection puts a Vercel login in front of preview URLs, which customers couldn't open.
- Preview deployments (other branches) aren't used for testing customer flows.

### 11.2 Migrations without Docker
- Write SQL by hand in `supabase/migrations/` (`npx supabase migration new <name>`).
- `npx supabase link --project-ref <dev-ref>` once. The owner provides the database password, or uses the Supabase connector.
- `npx supabase db push` applies new migrations to the linked project. **Run only after the owner approves that specific migration.**
- `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`
- No `db diff`, `db pull`, `start` or `test db` (they need Docker).

### 11.3 Environment variables
| Name | Scope |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | public |
| `APP_BASE_URL` | server (links, Origin check) |
| `SUPABASE_SECRET_KEY`, `SHARE_LINK_SECRET`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | **server only** |

**Per-feature validation.** `lib/env.ts` exposes small getters (`supabaseEnv()`, `adminEnv()`, `shareLinkEnv()`, `pushEnv()`, `cronEnv()`). Each validates only its own variables with zod **when that feature is first used** and throws a clear error naming the missing variable. Nothing is validated at build or import time, so `npm run build` and the M0 deploy work with no secrets at all, and missing VAPID or cron secrets never block earlier features. The getters still reject any server secret exposed under a `NEXT_PUBLIC_` name. Introduce variables as their features arrive: Supabase in M0.3, `SUPABASE_SECRET_KEY` in M1.2, `SHARE_LINK_SECRET` in M4.3, VAPID in M5.6, `CRON_SECRET` in M5.8. Locally: `.env.local` (git-ignored) with `APP_BASE_URL=http://localhost:3000`. Vercel: Production scope.

### 11.4 Deploys and domains
- Vercel is connected to the GitHub repo, so **a push to `main` deploys**. Pushes happen only with owner approval, which makes every deploy approved.
- Future custom domain: add it to the same Vercel project and keep `vercel.app` attached, redirecting `/t/*`. Tokens don't depend on the host. Then update `APP_BASE_URL` and the Vault `app_base_url`. Artisans re-install the PWA and re-enable notifications on the new origin.

---

## 12. Verification (lightweight)

**Every task:** `npm run typecheck` and `npm run lint`, plus a manual smoke test of what the task built (locally, or on the phone once deployed). That's the bar for Completed, along with no known critical issue.

**`npm run build` only:** at the end of each milestone, before every push/deploy, and after significant changes (new dependency, config or routing/middleware change, new route handler or service worker). Don't run it for trivial tasks.

**Always mandatory, never skipped:** the security check runs after every applied migration and in the tasks that extend it, and the critical Vitest files run when the code they cover changes.

**Automated tests: only these three Vitest files.**
1. `share-link`: sign, verify, tamper, old version, malformed input.
2. `scheduling`: overlap (half-open), slot suggestion, Istanbul ↔ UTC around midnight.
3. `public-dto`: the exact key set of `CustomerJobView`; the estimate, notes, phone and address are absent.

**`scripts/security-check.ts`** runs against the **dev** project with two fake artisan accounts (A, B) and the anon key. From M4.5 the link checks also call the app over HTTP: run them against a local production build (`npm run build && npm run start`, or `SECURITY_CHECK_BASE_URL`), because `next dev` adds debug output to error pages. It's extended in M1.7, M4.5, M5.9, M6.2 and M6.3, and prints PASS/FAIL per check:
- **RLS:** B can't select, insert, update or delete A's rows in any table, including with guessed IDs or cross-owner foreign keys. Anon gets nothing. Workflow columns (`jobs.status`, appointments, requests, events) can't be written directly.
- **Storage:** B can't read, list, upload into or delete A's paths. Anon can't read anything.
- **Links:** tampered, old-version, disabled and unknown tokens give an identical 404. Revocation is immediate, including for media. Customer actions are refused on an invalid link.
- **Exposure:** the customer page HTML and JSON contain no phone, address, note, estimate or private media. Public GETs don't write.
- **Consistency:** a double cancel → one cancellation, one notification. Concurrent accept vs withdraw → one consistent outcome. Accepting a counter → old appointment superseded, exactly one new appointment.
- **Push endpoint:** a missing or wrong bearer is rejected.
- **Admin panel (M6.2–M6.3):** artisan and anon get 404 on `/admin/*` and can't call admin actions; an admin session at `aal1` is refused; a deactivated artisan can't sign in or refresh.

**Real devices** (your phone, plus an iPhone/Android if available): checked in the relevant tasks and fully in M6.5. That covers HEIC upload, the voice recorder, install, and push with the app closed.

---

## 13. Milestones and tasks

Tasks marked 🔑 need owner input or approval (dashboard work, secrets, migration push, git push/deploy). Dependencies run in order unless noted. Full task list with status: [PROGRESS.md](PROGRESS.md).

### M0 — Foundation, Supabase Cloud, Vercel
**Goal:** an empty UstaPlan app live on HTTPS, connected to the dev database.

| Task | Content | Done when |
| --- | --- | --- |
| M0.1 🔑 | `git init`, `.gitignore`, commit docs, remote `origin` → push (approval) | Docs on GitHub |
| M0.2 | Scaffold Next.js (strict TS, `src/`, `lang="tr"`, UstaPlan metadata), Tailwind tokens, shadcn init, ESLint, Vitest, scripts, `lib/env.ts` (per-feature getters), `.env.example`, branded placeholder page | typecheck/lint/build pass locally **with no env vars set** |
| M0.3 🔑 | Supabase **dev** project (Ireland, T-10), signup disabled, keys in `.env.local`, `supabase link` | `link` succeeds; the app reads env |
| M0.4 🔑 | Vercel project from GitHub, Production env vars, `APP_BASE_URL` = vercel.app URL, first deploy (approval) | Branded page opens on the owner's phone over HTTPS |

### M1 — Authentication, RLS, customers and addresses
**Goal:** log in on the phone and manage customers safely.

| Task | Content | Done when |
| --- | --- | --- |
| M1.1 🔑 | Migration `core` (DATA_MODEL §2, §3, §5 `touch_updated_at`, §6), applied to dev (approval), types generated | Push succeeds; tables, RLS and buckets visible in the dashboard |
| M1.2 🔑 | `create-artisan.ts`, `reset-password.ts` (admin client, `SUPABASE_SECRET_KEY` in `.env.local`); create fake artisans A and B in dev (approval: creates users in the dev project) | Both users and profiles exist in the dashboard; reset changes the password hash; a failed run leaves no half-created user |
| M1.3 | Supabase clients, `proxy.ts`, `(app)` guard, `/giris` (with the forgot-password text), logout | A and B log in and out locally and on the phone; wrong password is refused; anonymous access to `/bugun` redirects to `/giris` |
| M1.4 | App shell: header (profile sheet), bottom nav, FAB, 4 tab pages with empty states, common components, domain helpers (labels, time, money, phone, fold) | Navigation works at 360 px on the phone |
| M1.5 | Ayarlar: profile form, password change | Profile persists; the old password fails after a change |
| M1.6 | Customers: list + Turkish-insensitive search, create/edit, detail with contact actions, address CRUD, delete only without jobs | Smoke: create → search "isik" finds "Işık" → address → call/WhatsApp links |
| M1.7 | `security-check.ts` v1: RLS isolation for every table, anon denial, storage isolation, workflow-column denial | All checks PASS against dev |

### M2 — Jobs, statuses, pricing, search, history
**Goal:** the job notebook works end to end without scheduling.

| Task | Content | Done when |
| --- | --- | --- |
| M2.1 🔑 | Migration `jobs`: `create_job`, `change_job_status`, `jobs_log_changes` (approval) | Applied; security check still PASS (+ the RPCs reject foreign jobs) |
| M2.2 | Yeni iş: recent-customer chips, inline customer, "Yapılacak iş", Diğer detaylar (address, prices, "Anlaşılan fiyatı müşteri görsün", private note) | A job for an existing customer in ≤ 4 interactions on the phone |
| M2.3 | İşler: Açık / Tamamlanan / İptal + search (title, customer, phone) | Smoke |
| M2.4 | İş detayı: edit, price block + history, status sheet (J1, J4–J6), reopen, timeline | All transitions behave per §7; price edits appear in the history |

### M3 — Appointments, conflicts, calendar, Bugün
**Goal:** scheduling with overridable warnings; Bugün as the daily home screen.

| Task | Content | Done when |
| --- | --- | --- |
| M3.1 🔑 | Migration `appointments`: `save_appointment`, `close_appointment` (approval) | Applied; J2/J3 verified in smoke |
| M3.2 | `scheduling.ts` + Vitest (overlap, suggestion, tz) | Tests pass |
| M3.3 | AppointmentPicker + ConflictCard in Yeni iş and İş detayı; reschedule, complete, cancel a visit | A conflict shows a warning and "Yine de kaydet" works; multiple visits per job |
| M3.4 | Takvim: day and week, conflict markers | Smoke |
| M3.5 | Bugün: summary, today's appointments with Ara / WhatsApp / Yol tarifi, Takip gerekenler incl. overdue | Unplanned, waiting and overdue jobs are always listed |

### M4 — Media, customer links, WhatsApp, customer page
**Goal:** the artisan shares a job, and the customer opens it on their phone.

| Task | Content | Done when |
| --- | --- | --- |
| M4.1 | Image preparation (HEIC, compress, EXIF) + artisan photo upload, register, private/shared toggle, delete; grid + viewer; photos on customer detail | An iPhone HEIC photo uploads ≤ 2 MB without GPS |
| M4.2 | Voice notes: record (60 s), list, play, delete | Works on the owner's phone (or shows the unsupported message) |
| M4.3 | `share-link.ts` + Vitest; `public-job.ts` DTO + Vitest; `/t/[token]` page, invalid page, headers, media proxy | Tests pass; the page opens from a phone |
| M4.4 | Share sheet (copy, WhatsApp message, disable/enable, regenerate); customer page Ara/WhatsApp; `/gizlilik` | A WhatsApp-shared link opens on a second phone; a regenerated link kills the old one |
| M4.5 | `security-check.ts` v2: links, exposure, read-only GETs, customer media restrictions | All checks PASS |

### M5 — Customer actions, notifications, PWA, Web Push
**Goal:** the full MVP feature set.

| Task | Content | Done when |
| --- | --- | --- |
| M5.1 🔑 | Migration `customer_cancel`: `public_cancel_job` (approval); cancel route + CancelSheet (reason required, note required for "Diğer", confirmation); in-app notification | The customer cancels from a phone; the artisan sees it; reopen works |
| M5.2 | Customer photo upload and delete (magic bytes, rate limits, job state) + in-app notification | Upload on a completed job works; on a cancelled job it's refused; artisan photos can't be deleted through the link |
| M5.3 🔑 | Migration `reschedule`: reschedule RPCs + `respond_to_request` (approval); customer RescheduleSheet (request, withdraw, accept); artisan RequestCard on Bugün and İş detayı | Request → counter → accept swaps atomically; the old appointment is untouched until then |
| M5.4 | Inbox: bell + badge, `/bildirimler`, mark read; **auto-refresh** (T-14) in the artisan shell and on the customer page | Badge updates after customer actions; a change made on the other phone appears without a manual reload (on return to the app, or within the interval while visible) |
| M5.5 | PWA: `sw.js` (offline page + push and click handlers), install guide in Ayarlar. *(Manifest + icons were moved forward to M1.5, owner-approved 2026-10-18: without them iOS opened every non-start page in an in-app browser.)* | Installs on the phone; the app opens standalone |
| M5.6 🔑 | Web Push: VAPID keys (owner adds them to Vercel), Ayarlar → Bildirimler (iOS gating, enable, disable, test), `push_subscriptions`, `lib/push.ts` | The test push arrives on the phone **with the app closed** |
| M5.7 | Immediate pushes for cancel, reschedule request, counter accepted via `after()` | Each arrives once, without cron |
| M5.8 🔑 | Dispatcher endpoint (reminders, digest, retries, cleanup) + migration `cron` + Vault secrets (owner runs the SQL template) (approval) | 1-hour reminder and 08:00 digest arrive on the phone; no duplicates |
| M5.9 | `security-check.ts` v3: cancel/reschedule consistency, dispatcher auth | All checks PASS |

### M6 — Admin panel and pilot readiness
**Goal:** an owner-only admin panel, then a safe hand-over to 1–2 tradespeople.

| Task | Content | Done when |
| --- | --- | --- |
| M6.1 | Scope-change docs for the admin panel: spec v1.5, plan v3.2, CLAUDE.md, DATA_MODEL note, README | The docs agree; the owner has reviewed the diff |
| M6.2 🔑 | `requireAdmin()` + `/admin` shell + TOTP enroll/challenge + login redirects + `scripts/create-admin.ts`; create the admin account in **dev** (approval). security-check: artisan and anon get 404 on `/admin/*` and admin actions are refused; an admin session at `aal1` is refused | The owner logs in with TOTP on the deployed URL; security check passes |
| M6.3 | **Ustalar:** list + detail + create / reset password / deactivate / reactivate; `lib/admin/accounts.ts` shared with the refactored scripts. security-check: a deactivated artisan can't sign in or refresh and has no push rows; reactivation restores login. Verify against the Supabase docs whether existing access tokens are cut at once; if not, the UI and docs state the ≤ 1 h JWT lifetime | The actions work end to end on dev with fake artisans A/B; security check passes |
| M6.4 | **Genel bakış:** overview figures, 12-week trend, active artisans, system health; desktop + 360 px; `npm run build`, deploy (approval) | Figures match SQL counts on dev; build passes |
| M6.5 | Full mobile smoke pass (the scenarios in the setup checklist) on the available iPhone/Android; fix critical issues | No critical issues open |
| M6.6 | `backup.sh`, `delete-customer-data.ts`, `export-customer-data.ts`, `docs/setup/RUNBOOK.md` | Dry runs succeed on dev |
| M6.7 🔑 | **Prod** Supabase project, migrations pushed, Vault, signup off; Vercel Production env switched to prod; pilot accounts; admin account (`create-admin.ts`) + TOTP enrolled in prod; prod smoke (approval; KVKK review done) | A pilot artisan logs in on their phone and receives a test push; the owner opens `/admin` in prod with TOTP |

**Order:** M0 → M1 → M2 → M3 → M4 → M5 → M6, tasks in numeric order. **41 tasks.**
Possible reordering: M5.5–M5.6 (PWA + test push) depend only on M1 and could move right after M1 if you want push verified early.

---

## 14. Risks
| Risk | Mitigation |
| --- | --- |
| Push delivery not guaranteed; iOS needs an installed PWA (16.4+) | Clear Settings copy; the Bugün screen and inbox stay authoritative; tested on real phones from M5.6 |
| Fewer automated tests → regressions | Security script re-run after every migration; the 3 critical Vitest files; typed DB; smoke test per task |
| Dev and prod both on Free: projects pause after ~7 idle days | The cron call keeps the active one awake; restore the dev project from the dashboard if it pauses |
| No backups on Free | Weekly `backup.sh` (M6.6) |
| Vercel Hobby is non-commercial | Upgrade before commercial use |
| `pg_net` is fire-and-forget | The next 5-min cycle retries; immediate pushes don't depend on it |
| Migration mistakes against the hosted DB (no local sandbox) | Small, reviewed, forward-only migrations; owner approval per push; dev project only until M6.7 |
| Link holder acts as the customer | Owner-accepted; revoke/regenerate, no personal data, rate limits, audit events |
| HEIC on non-Safari browsers | Lazy `heic2any` fallback |
| KVKK cross-border transfer | Legal review before real customer data (gates M6.7) |
| Public GitHub repo | No secrets, Vault values or real data in git |

---

## 15. Defaults and decisions (unchanged from v2 unless noted)

⚑ = materially affects permissions, cancellation, retention or UX.

| ID | Rule | ⚑ |
| --- | --- | --- |
| P-1 | `jobs.description` dropped; `title` is customer-visible (labelled), `private_note` is private (replaced by `job_notes`, N-1) | ⚑ |
| P-2 | Cancellation cancels only appointments that haven't ended | ⚑ |
| P-3 | No job deletion in the app; erasure via the admin script | ⚑ |
| P-4 | Completing a job cancels its future appointments after confirmation | ⚑ |
| P-5 | Customers may cancel `in_progress` / `waiting_material` jobs | ⚑ |
| P-6 | No reminder for appointments created < 60 min ahead; ±5 min; digest every day only when needed | ⚑ |
| P-7 | Artisan cancellation: optional note, no automatic customer message | ⚑ |
| P-8 | Notifications per device; logout disables that device | ⚑ |
| P-9 | Artisans may delete customer-uploaded photos | ⚑ |
| P-10 | Customer media via the token-verified proxy (immediate revocation) | |
| P-11 | Customers may delete their photos on cancelled jobs | ⚑ |
| P-12 | `unplanned`/`scheduled` derived; last completed visit → `in_progress` | ⚑ |
| P-13 | Reopen re-activates the same link for customer actions | ⚑ |
| D-7 | Customers with jobs can't be deleted in the app | ⚑ |
| T-1 | Route `/t/[token]` | |
| T-2 | **v3:** only 9 RPCs; plain RLS CRUD otherwise; share toggles as column updates logged by the trigger | |
| T-3 | Versioned HMAC links | |
| T-4 | **v3:** reminder, digest and cleanup logic in one TypeScript dispatcher; one cron schedule | |
| T-5 | `notifications` = inbox + push outbox; claim by conditional update | |
| T-6 | **v3:** hosted dev + prod Supabase projects; no Docker | |
| T-7 | **v3.1:** verification = typecheck/lint + smoke per task; build at milestone ends, before deploys, after significant changes; 3 Vitest files + security script mandatory where relevant | |
| T-8 | **v3.1:** timestamped migration names from `supabase migration new` | |
| T-9 | **v3.1:** env validated lazily per feature; the build needs no secrets | |
| T-12 | **M2.1:** `create_job` takes a caller-generated `job_id` (idempotent create). "Future" appointments in J4/J6 = `ends_at > now()` (P-2). `jobs_log_changes` refuses a lower `share_version`. Supabase advisor lint 0029 (definer RPCs executable by `authenticated`) is accepted by design: each RPC checks `auth.uid()` and ownership, covered by `security-check.ts`. | |
| T-15 | **M5.7 (owner):** a notification can be older than the request it announced. Date-request pushes and inbox items open `/isler/<job>?talep=<request>`; the job page explains what happened to that request since (withdrawn, replaced — following the chain to the newest request —, answered, closed; `lib/domain/request-outcome.ts`) and the inbox shows its status. Withdrawals are pushed too (the withdraw route turns the RPC's inbox-only row to `pending` once), with the request's tag so they replace the earlier "yeni tarih istedi" on the phone. Target/tag rule: `lib/push/target.ts`. | |
| T-14 | **M5.4 (owner):** no realtime subscriptions. The installed app and the customer page have no reload button, so one small client component calls `router.refresh()` when the page becomes visible again and on an interval (~30–60 s) while visible, paused while a sheet/dialog is open or an input has focus. No new dependency or service. Supabase Realtime was rejected: the customer side has no session (anon has nothing), and the artisan side would need a publication migration and a live connection. Closed/background apps rely on Web Push (M5.6–M5.7). | |
| T-13 | **M3.1:** `save_appointment` keeps the DATA_MODEL signature; idempotency = same job + same times returns the existing (or replacement) appointment. Past times are allowed so a visit can be recorded late. Derived J2/J3 status changes write no extra `status_changed` event (the appointment event explains them). | |
| T-11 | **M1.5 (owner):** manifest (`scope: "/"`, `start_url: /bugun`, standalone) + apple-icon + 192/512 icons moved forward from M5.5 so the iOS home-screen app stays standalone across tabs. | |
| A-1 | **v3.2 (owner):** owner-only admin panel at `/admin` (English route, a deliberate exception to the Turkish-routes rule; UI copy Turkish, *sen*). Built before the pilot as M6.1–M6.4 | ⚑ |
| A-2 | **v3.2 (owner):** admin = separate auth user with `app_metadata.role = "admin"` and no profile; every admin page/action requires a TOTP-verified session (`aal2`); everyone else gets 404. Exactly one admin; no roles UI | ⚑ |
| A-3 | **v3.2 (owner):** deactivation = auth ban + the artisan's push subscriptions deleted; data untouched; **customer links keep working**; reactivation restores it. No delete in the panel (erasure stays with the M6.6 scripts) | ⚑ |
| A-4 | **v3.2:** the panel shows per-artisan counts only, never customer personal data or job content; figures computed in TypeScript with the admin client (no RPC, no migration, no chart library, no analytics service) | ⚑ |
| A-6 | **M6.3:** a deactivated artisan's refresh is refused at once, but an already-issued access token stays valid until it expires (≤ 1 h), because the app checks JWTs locally with `getClaims()`. Accepted; the confirmation text says so. The admin changes their own password at `/admin/sifre` (the shared Ayarlar form) | |
| L-1 | **Owner, 2026-10-18:** public landing page at `/` for signed-out visitors (`src/app/page.tsx`, static; illustration drawn with the app tokens in `components/landing/phone-preview.tsx`). Sections: hero, features, how it works, customer link, FAQ, login. No signup and no contact button (pilot accounts by invitation); FAQ says free during the pilot. *sen* tone like the artisan app. The only indexable page (`robots: index`); the root layout stays `noindex`. Proxy: signed-out visitors may open `/` and `/giris`; sessions on `/` go to `/bugun` or `/admin` | |
| L-2 | **Owner, 2026-10-18:** SEO for `/` (canonical from `APP_BASE_URL`, Open Graph + share image `(landing)/opengraph-image.tsx` scoped to the landing route group, Twitter card, JSON-LD SoftwareApplication + FAQPage) and a **search-visibility switch** at `/admin/site`, stored in `app_settings`, **hidden by default**. Hidden: `/` is `noindex, nofollow`, `robots.txt` disallows everything, `sitemap.xml` is empty. Visible: `/` is indexable, `robots.txt` allows `/` and disallows the app paths, `sitemap.xml` lists `/`. Every other page stays `noindex` (root layout). Read through `'use cache'` + `cacheTag('site-settings')`; the admin action calls `updateTag`, so changes apply at once; any read error means hidden | |
| N-1 | **Owner, 2026-10-20:** job notes. (1) Several private written notes per job (`job_notes`, author `artisan`): add, edit ("Düzenlendi"), delete with confirmation; the old `jobs.private_note` was copied into the list and dropped; one "Notlarım" card holds written and voice notes. (2) **N.2:** written + voice notes in Yeni iş → Diğer detaylar; written notes go into `create_job(p_notes)` in the same transaction; recordings stay in browser memory until the job exists, then upload; a failed upload offers retry or continue without losing the job; leaving the form discards them; without recordings the form still redirects at once. (3) **N.3:** customers add/edit/delete their own written notes (≤ 1000, no voice) on `/t/<token>` **only while the job is open** (afterwards read-only); plain admin CRUD in `/api/t/[token]/notes` (Origin, token, zod, row-counted rate limits, `note_*` audit events); artisan sees them in "Müşteri notları" without edit/delete; `customer_note` notification (one per job per day, first one pushed). Customer notes never include artisan notes; no new RPC | ⚑ |
| U-1 | **Owner, 2026-10-20:** UI polish. Sub-pages put the back button and title on one row (`PageHeader backHref`); detail pages tighten the space under "Geri". Yeni iş: searchable customer selector (`components/jobs/customer-picker.tsx`: name or phone, ≤ 6 results in a scrollable list, recent customers on an empty query, selected customer card with "Değiştir", "Yeni müşteri" always visible, "“…” için yeni müşteri ekle" when nothing matches, preselected from a customer page); Diğer detaylar with a chevron, price hints (agreed = final amount, estimate = rough amount, never shown to customers, under its own field; same in İşi düzenle), private notes as 2-line auto-growing fields saved with the job (no separate save step) next to the voice recorder, and "Kayıtlı adres yok" + "Adres ekle" opening the existing address form in a sheet. Bugün: visit time on one line; an overdue visit shows a "Ziyaret gecikti" badge instead of the job status. Müşteri: compact empty states ("Kayıtlı adres yok" + "Adres ekle", "Telefon numarası ekle"). İşler: the card date says what it is ("Güncellendi / Tamamlandı / İptal edildi"), under the status badge | |
| A-5 | **v3.2:** no admin audit table; Supabase's auth audit log records user creation, password updates and bans. Temporary passwords are shown once and never logged or stored | |
| T-10 | **M0.3 (owner):** the dev project is in Ireland (`eu-west-1`), not Frankfurt; fake data only, so accepted. Vercel functions should run near it (M0.4). **Prod (M6.7) stays in Frankfurt.** | |

---

## 16. Source-document findings
All 37 findings from the review remain resolved as recorded in plan v2. The resolutions live in spec v1.4, DATA_MODEL §9 and §15 above. The key ones:
- the invalid route syntax
- the missing inbox route
- the starter schema gaps (profiles update, notifications read, direct workflow writes, address FK, request statuses, enums, storage policy)
- the undefined status-sync rules
- the password-change verification
- the HEIC/MIME mismatch
- the WhatsApp preview GETs
- KVKK
- push changed from optional to mandatory
