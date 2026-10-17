# UstaPlan — Target Data Model (reconciled)

**Status:** Approved design. Implemented so far: `core` (M1.1: §2 tables, §3 grants/RLS, §5 `touch_updated_at`, §6 storage). Hand-written migrations under `supabase/migrations/` implement it incrementally (plan v3: M1.1 core, M2.1 jobs, M3.1 appointments, M5.x customer actions and cron). They are applied to the hosted dev project with the Supabase CLI (no Docker), only with owner approval. The [starter schema](03_SCHEMA_STARTER.sql) is kept only as a reference; §9 lists every difference and why.

Conventions:
- All tables live in `public` with RLS enabled. Every child row carries `owner_user_id`. Composite foreign keys `(owner_user_id, parent_id)` stop a row being attached to another artisan's data, even if someone guesses a UUID.
- Times are `timestamptz` (UTC). Business time zone is `Europe/Istanbul`. Money is `numeric(12,2)` in TRY.
- Status and enum values are English `text` codes with `check` constraints (easier to evolve than Postgres enums). Turkish labels live in the app.
- `created_at` and `updated_at` default to `now()`. A `touch_updated_at` trigger sets `updated_at` on every mutable table.
- No secrets or environment-specific URLs in migrations. The repository is public.

---

## 1. Entity overview

```
auth.users 1─1 profiles 1─* customers 1─* customer_addresses
                  │            └─* jobs *─0..1 customer_addresses
                  │                   ├─* appointments 1─* appointment_requests
                  │                   ├─* job_media
                  │                   └─* job_events
                  ├─* notifications *─0..1 jobs
                  └─* push_subscriptions
```

---

## 2. Tables

### profiles
| Column | Type | Rules |
| --- | --- | --- |
| id | uuid PK | FK `auth.users(id)` on delete cascade |
| display_name | text | not null, 1–80 chars |
| business_name | text | null, ≤120 |
| contact_phone | text | null, E.164 check `^\+[1-9][0-9]{7,14}$`. **Shown to customers.** |

The admin script creates rows. No auth trigger.

### customers
| Column | Type | Rules |
| --- | --- | --- |
| id | uuid PK | |
| owner_user_id | uuid | FK profiles on delete cascade; `unique (owner_user_id, id)` |
| name | text | not null, 1–160 |
| phone | text | null, E.164 check (normalised by the app) |
| private_note | text | null, ≤2000 |
| search_key | text | **generated**: `fold_tr(name) || ' ' || coalesce(phone,'')` |

`fold_tr(text)` is an immutable SQL function. It maps `İ I ı → i`, `Ç ç → c`, `Ğ ğ → g`, `Ö ö → o`, `Ş ş → s`, `Ü ü → u`, then lowercases. The app folds the search query the same way.

### customer_addresses
| Column | Type | Rules |
| --- | --- | --- |
| id, owner_user_id, customer_id | uuid | FK `(owner_user_id, customer_id)` → customers on delete cascade; `unique (owner_user_id, customer_id, id)` |
| label | text | null, ≤40 ("Ev", "İş") |
| address_text | text | not null, 1–500 |

### jobs
| Column | Type | Rules |
| --- | --- | --- |
| id | uuid PK | `unique (owner_user_id, id)` |
| owner_user_id | uuid | FK profiles on delete cascade |
| customer_id | uuid | FK `(owner_user_id, customer_id)` → customers **on delete restrict** |
| address_id | uuid null | FK `(owner_user_id, customer_id, address_id)` → customer_addresses **on delete set null (address_id)** |
| title | text | not null, 1–200. "Yapılacak iş". **Customer-visible.** |
| search_key | text | generated `fold_tr(title)` |
| status | text | `unplanned · scheduled · in_progress · waiting_material · completed · cancelled`, default `unplanned`. **RPC-only.** |
| private_note | text | null, ≤4000. Artisan-only. |
| estimated_price | numeric(12,2) | null, ≥0. **Never customer-visible.** |
| agreed_price | numeric(12,2) | null, ≥0 |
| currency | text | `'TRY'` |
| show_price_to_customer | boolean | default false; check `not show_price_to_customer or agreed_price is not null` |
| share_enabled | boolean | default true. Plain owner update (§3); logged by `jobs_log_changes`. |
| share_version | integer | default 1, >0. Plain owner update (§3); logged by `jobs_log_changes`. |
| cancelled_reason | text | null; in `no_longer_needed, price_too_high, changed_mind, other_artisan, date_unsuitable, other` |
| cancelled_note | text | null, ≤500 |
| cancelled_by | text | null; `customer · artisan` |
| cancelled_at, completed_at | timestamptz | null |

Consistency checks:
- `(status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null)`
- `(status = 'completed') = (completed_at is not null)`
- `cancelled_by <> 'customer' or cancelled_reason is not null`
- `cancelled_reason <> 'other' or cancelled_by <> 'customer' or length(btrim(cancelled_note)) > 0`

The starter's `description` column is **dropped** (P-1). The artisan has one shared field (`title`) and one private field (`private_note`).

### appointments
| Column | Type | Rules |
| --- | --- | --- |
| id, owner_user_id, job_id | uuid | FK `(owner_user_id, job_id)` → jobs on delete cascade; `unique (owner_user_id, job_id, id)` |
| starts_at, ends_at | timestamptz | `ends_at - starts_at between 15 min and 480 min` |
| status | text | `scheduled · completed · cancelled · superseded` |
| replaced_by_id | uuid null | self FK; set only when `superseded` |
| closed_at | timestamptz null | set when leaving `scheduled` |
| private_note | text | null, ≤1000 |

Index: `(owner_user_id, starts_at, ends_at) where status = 'scheduled'`. **All writes go through RPCs.**

### appointment_requests
| Column | Type | Rules |
| --- | --- | --- |
| id, owner_user_id, job_id, appointment_id | uuid | FK `(owner_user_id, job_id, appointment_id)` → appointments on delete cascade |
| requested_starts_at / requested_ends_at | timestamptz | ends > starts |
| counter_starts_at / counter_ends_at | timestamptz null | both or neither; ends > starts |
| request_note | text | null, ≤500 |
| status | text | `pending_artisan · pending_customer · accepted · rejected · withdrawn · closed` |
| resolved_at | timestamptz null | set on any terminal status |
| resulting_appointment_id | uuid null | set when `accepted` |

Partial unique index: one open negotiation per appointment (`status in ('pending_artisan','pending_customer')`). **Artisans can only select; all writes go through RPCs.**

### job_media
| Column | Type | Rules |
| --- | --- | --- |
| id, owner_user_id, job_id | uuid | FK `(owner_user_id, job_id)` → jobs on delete cascade |
| kind | text | `image · audio` |
| origin | text | `artisan · customer` |
| visibility | text | `private · shared` |
| storage_bucket | text | `job-images · job-audio` |
| storage_path | text unique | check `storage_path like owner_user_id::text || '/' || job_id::text || '/%'` |
| mime_type | text | not null |
| size_bytes | integer | images ≤ 2 097 152; audio ≤ 4 194 304 |
| duration_seconds | integer null | audio only, 1–60 |
| deleted_at | timestamptz null | soft delete |
| deleted_by | text null | `artisan · link_holder` |

The starter's combination check is kept: audio is always artisan + private + `job-audio`, and customer images are always `shared`.

### job_events (audit + history)
| Column | Type | Rules |
| --- | --- | --- |
| id, owner_user_id, job_id | uuid | FK → jobs on delete cascade |
| event_type | text | check in the list below |
| actor_type | text | `artisan · link_holder · system` |
| payload | jsonb | never contains phone numbers or addresses |

Event types: `job_created, job_updated, status_changed, price_changed, price_visibility_changed, appointment_scheduled, appointment_rescheduled, appointment_completed, appointment_cancelled, request_created, request_countered, request_accepted, request_rejected, request_withdrawn, request_closed, job_cancelled, job_reopened, media_added, media_deleted, share_disabled, share_enabled, share_rotated`.

**Price history:** an `after update` trigger on `jobs` writes `price_changed` (`{field, old, new}`) when `estimated_price` or `agreed_price` changes, and `price_visibility_changed` when `show_price_to_customer` changes. It captures every write path, not just one action. Inserts from the trigger and RPCs only.

### notifications
| Column | Type | Rules |
| --- | --- | --- |
| id, owner_user_id | uuid | FK profiles on delete cascade |
| job_id | uuid null | FK `(owner_user_id, job_id)` → jobs on delete cascade |
| appointment_id, request_id | uuid null | context links |
| category | text | see table below |
| payload | jsonb | snapshot needed for rendering (job title, customer first name, times, reason code). The app renders the Turkish title and body from `category + payload` in one place. |
| dedupe_key | text not null | `unique (owner_user_id, dedupe_key)`. Guarantees one notification per event or reminder. |
| in_inbox | boolean | whether it appears in `/bildirimler` |
| read_at | timestamptz null | |
| push_status | text | `none · pending · sending · sent · failed · skipped` |
| push_attempts | smallint | default 0 |
| push_next_attempt_at, pushed_at | timestamptz null | |

| Category | Push | Inbox | Dedupe key |
| --- | --- | --- | --- |
| `customer_cancelled` | immediate | yes | `cancel:<job_id>` |
| `reschedule_requested` | immediate | yes | `request:<request_id>` |
| `counter_accepted` | immediate | yes | `accepted:<request_id>` |
| `request_withdrawn` | — | yes | `withdrawn:<request_id>` |
| `customer_photo_added` | — | yes (one item per job per day; repeat uploads increment `payload.count` and mark it unread again) | `photos:<job_id>:<YYYY-MM-DD Istanbul>` |
| `appointment_reminder` | scheduled | no | `appt-reminder:<appointment_id>` |
| `daily_digest` | scheduled | no | `digest:<YYYY-MM-DD Istanbul>` |

### push_subscriptions
| Column | Type | Rules |
| --- | --- | --- |
| id | uuid PK | |
| owner_user_id | uuid | FK profiles on delete cascade |
| endpoint | text | `unique (owner_user_id, endpoint)` (one row per user per browser/device) |
| p256dh, auth | text | not null |
| device_label | text | null, derived from the user agent ("iPhone", "Android Chrome") |
| created_at, last_success_at | timestamptz | |
| failure_count | smallint | default 0. Rows are deleted after a 404/410 response or 5 consecutive failures. |

One user can have many devices. Logout deletes the current device's row, so a shared phone doesn't receive another user's pushes.

---

## 3. Grants and RLS (role `authenticated`)

All policies check `owner_user_id = (select auth.uid())` (`id` for profiles). `anon` has no table privileges and no function `execute` rights. The `core` migration also removes `anon` from the schema's default privileges. PostgreSQL's built-in `EXECUTE` for `PUBLIC` can't be removed per schema, so **every new function must `revoke execute … from public, anon`** and grant only what it needs. **Plain RLS-protected CRUD is the default.** RPCs exist only where several rows must change together (§4).

| Table | select | insert | update (columns) | delete |
| --- | --- | --- | --- | --- |
| profiles | own | — (admin script) | `display_name, business_name, contact_phone` | — |
| customers | own | own | `name, phone, private_note` | own (FK restrict when jobs exist) |
| customer_addresses | own | own | `label, address_text` | own |
| jobs | own | **RPC** (`create_job`) | `customer_id, address_id, title, private_note, estimated_price, agreed_price, show_price_to_customer, share_enabled, share_version` | **none** (P-3) |
| appointments | own | RPC | RPC | — |
| appointment_requests | own | RPC | RPC | — |
| job_media | own | own, with check `origin='artisan' and deleted_at is null` | `visibility, deleted_at, deleted_by` | — (soft delete) |
| job_events | own | — (RPCs + trigger) | — | — |
| notifications | own | — (server) | `read_at` | — |
| push_subscriptions | own | own | — | own |

`jobs.status` and the `cancelled_*`/`completed_at` columns aren't in the update grant, so status changes can only go through `change_job_status`. `share_enabled`/`share_version` are plain updates. The trigger in §5 logs them as events.

RPCs are `security definer` with `set search_path = ''` and assert ownership (`auth.uid()`) or the share version themselves, because a definer function bypasses RLS.

---

## 4. Functions (kept deliberately few)

### Artisan RPCs (`execute` to `authenticated`)
Each one locks the job row (`select … for update`), validates the transition, writes rows plus `job_events`, and returns a result code. Repeating a call that already succeeded returns success without duplicating anything.

| Function | Effect |
| --- | --- |
| `create_job(customer_id \| new_customer {name, phone}, address_id, title, private_note, estimated_price, agreed_price, show_price, starts_at?, ends_at?)` | Optional inline customer + job + optional first appointment, in one transaction (status `scheduled` or `unplanned`). |
| `change_job_status(job_id, action, note?)` | `action ∈ start · wait_material · complete · cancel · reopen`. Applies plan §7 rules J1–J6, including cascades to appointments and requests. |
| `save_appointment(job_id, appointment_id?, starts_at, ends_at)` | New appointment, or reschedule (old one `superseded` + `replaced_by_id`, open request `closed`). Applies J2. |
| `close_appointment(appointment_id, outcome)` | `outcome ∈ completed · cancelled`; closes the open request; applies J3. |
| `respond_to_request(request_id, action, counter_starts_at?, counter_ends_at?)` | `approve · reject · counter`; approve does the atomic swap. |

Conflict lookup is **not** a function. It's an ordinary RLS-scoped select (`status='scheduled' and starts_at < :end and ends_at > :start`).

### Public RPCs (`execute` to `service_role` only)
Signature: `(job_id uuid, share_version int, …)`. Each one locks the job and returns `link_invalid` unless `share_enabled` is true and the version matches.

`public_cancel_job(reason, note)` · `public_request_reschedule(starts_at, note)` (replaces a pending counter in the same transaction) · `public_withdraw_request(request_id)` · `public_accept_counter(request_id)`

They insert the related notification (`push_status='pending'`) in the same transaction.

Customer **photo** add and delete aren't RPCs. The route handler validates the token and checks the job state, rate limits and media ownership, then uses the admin client for the storage call and the row insert or soft-delete. Plain CRUD is enough because they are single-row changes.

### Notifications (no functions)
The dispatcher endpoint (plan §9) uses the admin client:
- **Due reminders:** select due appointments, then `upsert` notifications with `onConflict: owner_user_id,dedupe_key, ignoreDuplicates`.
- **Claim:** `update … set push_status='sending' where id in (…) and push_status in ('pending','failed') returning *`. A second concurrent dispatcher gets no rows back, so each notification is sent once.

---

## 5. Triggers
- `touch_updated_at` on profiles, customers, customer_addresses, jobs, appointments, appointment_requests.
- `jobs_log_changes` (after update, `security definer`): writes `price_changed` (`{field, old, new}`), `price_visibility_changed`, `share_enabled`/`share_disabled`/`share_rotated` and `job_updated` (title, address) events. This gives price history without extra code paths.

---

## 6. Storage
| Bucket | Public | Size limit | MIME |
| --- | --- | --- | --- |
| `job-images` | no | 2 MB | `image/jpeg, image/png, image/webp` |
| `job-audio` | no | 4 MB | `audio/webm, audio/mp4, audio/ogg, audio/mpeg, audio/x-m4a` |

Path: `<owner_id>/<job_id>/<media_id>.<ext>`. Policies on `storage.objects` for `authenticated` allow select, insert and delete when folder 1 is `auth.uid()` **and** folder 2 is a job owned by `auth.uid()`. There is no update policy, so objects can't be overwritten. `anon` gets nothing. Customer media goes through the server only.

---

## 7. Scheduled jobs (Supabase Cron = `pg_cron` + `pg_net`)

A single schedule keeps it simple:

| Name | Schedule (UTC) | Action |
| --- | --- | --- |
| `ustaplan-dispatch` | `*/5 * * * *` | `net.http_post(<app_base_url>/api/internal/dispatch)` with `Authorization: Bearer <cron_secret>` |

The endpoint does everything time-based in TypeScript, so all logic lives in one place:
1. Create due appointment reminders (T−60 min).
2. Create the daily digest when it's past 08:00 Istanbul time and today's digest doesn't exist yet. The dedupe key makes it once per day.
3. Send pending pushes and retry failed ones.
4. Once a day (first run after 03:00 Istanbul): remove orphaned or soft-deleted storage objects and stale `sending` rows.

The base URL and secret are read from **Supabase Vault** at run time. The administrator inserts them once per project and they are never committed. The schedule is created by a migration that references Vault secret names only. The 5-minute call also keeps the free project from pausing for inactivity.

---

## 8. Retention
- Nothing is deleted automatically in the pilot. Cancelled and completed jobs, events and notifications are kept.
- Customers can be deleted in the app only when they have no jobs.
- Full erasure (a customer, their jobs, media objects, events, notifications) uses the admin script `scripts/delete-customer-data.ts`, following [PRIVACY_AND_DATA_REQUESTS.md](../setup/PRIVACY_AND_DATA_REQUESTS.md).
- Soft-deleted media rows remain, without their files, as an audit trail until the customer is erased.

---

## 9. Reconciliation with `03_SCHEMA_STARTER.sql`

| # | Starter | Target | Reason |
| --- | --- | --- | --- |
| 1 | `profiles`: select only | Owner may update 3 columns | Settings must save the profile |
| 2 | `jobs.description` | Dropped | P-1: simpler form; less customer-visible text |
| 3 | `jobs` direct insert/update/delete for all columns | Insert via `create_job`; column-level update grant (status only via `change_job_status`); no delete | Status/share/cancel fields stay consistent; no accidental loss of history |
| 4 | `jobs.address_id` FK, no delete action | `on delete set null (address_id)` | Deleting an address used by a job would fail |
| 5 | `jobs.customer_id` FK, implicit no action | Explicit `on delete restrict` | Keep history; deliberate erasure goes through the admin script |
| 6 | No cancel reason values or consistency checks | Checks for reason codes, the "other requires note" rule, and status vs timestamps | Rules enforced in the database |
| 7 | `show_price_to_customer` unconstrained | Requires `agreed_price` | Estimates are never exposed |
| 8 | `appointments` direct CRUD | `save_appointment` / `close_appointment` only; `replaced_by_id`, `closed_at`, 15–480 min check | Atomic rescheduling; spec §4.3 |
| 9 | `appointment_requests` direct CRUD; 5 statuses | Select only; adds `closed`, `resolved_at`, `resulting_appointment_id` | System-closed negotiations; auditability |
| 10 | `job_media` artisan full CRUD; one 4 MB limit | Insert with origin check; update only `visibility`/soft-delete columns; size limit per kind; path prefix check; `deleted_by`, `duration_seconds` | Ownership and integrity |
| 11 | `job_events.event_type` free text; no write path | Checked list; written by the few RPCs and the `jobs_log_changes` trigger | Reliable history including prices |
| 12 | `notifications`: title/body, select only | `payload` + app rendering, `dedupe_key`, `in_inbox`, push delivery columns, `read_at` update | Inbox, push, no duplicates |
| 13 | — | `push_subscriptions` | Web Push is in the MVP |
| 14 | Rate-limit records "DB-based", no table | Counted from existing rows in public RPCs | No extra table |
| 15 | Storage policies check only the owner folder | Also check that folder 2 is the owner's job; no update | Tighter isolation |
| 16 | `create table if not exists` mixed with plain `create policy` | Plain, forward-only migrations | Predictable migrations |
| 17 | No search support | `fold_tr` + generated `search_key` | Turkish-insensitive search (İ/ı/ş…) |
| 18 | Cron, Vault: none | `pg_cron`, `pg_net`, Vault secrets | Scheduled reminders on Supabase Free |
