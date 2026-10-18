# UstaPlan Runbook (pilot)

Day-to-day operation for the owner. Commands run from the repository folder with `.env.local` filled in (secret key of the project you mean: **dev** until M6.7, then **prod**). Never paste secrets, passwords or customer data into chat, issues or the repository.

## 1. Accounts (admin panel)

Sign in at `/giris` with the admin account; `/admin` asks for the authenticator code.

| Task | Where |
| --- | --- |
| New artisan | *Ustalar → Usta ekle*. The temporary password is shown once: send it privately (e.g. WhatsApp). The artisan changes it in Ayarlar. |
| Forgotten password | *Ustalar → (artisan) → Geçici şifre oluştur*. The old password stops working. |
| Pause an artisan | *Devre dışı bırak*: no sign-in, no session refresh, push devices removed. An already open session ends within 1 h. Data and customer links stay. *Yeniden etkinleştir* undoes it (notifications are turned on again per device). |
| Your own password | *Şifre* in the panel header. |
| Lost authenticator | `npm run admin:create-admin -- --email <admin email> --reset-mfa`, then sign in and scan a new QR. |
| First admin account (once per project) | `npm run admin:create-admin -- --email <your email>`; prints a temporary password once. Change it under *Şifre*. |

The local scripts still work without the panel: `admin:create-artisan`, `admin:reset-password` (README).

## 2. Weekly backup

```bash
scripts/backup.sh ~/UstaPlan-backups
```

Writes `ustaplan-<date>/db.dump` (public, auth and storage schemas) and `storage/` (every photo and voice note) outside the repository, and deletes backup folders older than 28 days (privacy doc §3.9). One-time setup: `brew install libpq && brew link --force libpq`, and `SUPABASE_DB_URL=<Session pooler URI with the DB password>` in `.env.local` (Supabase dashboard → Connect). Keep the backup folder on an encrypted disk; it holds real personal data.

## 3. Restore (new or emptied project)

1. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push` (owner approval, as for every migration).
2. Data: `pg_restore --dbname "<target Session pooler URI>" --no-owner --no-privileges --data-only --schema=public --schema=auth <backup>/db.dump`. (The storage schema in the dump is for reference only; objects come back in step 3.)
3. Files: with `.env.local` pointing at the target project, `npx tsx --env-file-if-exists=.env.local --conditions=react-server scripts/restore-storage.ts <backup>/storage` (skips files that already exist; safe to repeat).
4. Re-apply every erasure from the private request log that is newer than the backup (`admin:delete-customer`, below). **Never skip this step.**
5. Vault secrets (`scripts/vault-secrets.sql.example`) and the Vercel env must point at the restored project; run `npm run security-check` against it.

## 4. Customer data requests (KVKK)

Process and response times: [PRIVACY_AND_DATA_REQUESTS.md](PRIVACY_AND_DATA_REQUESTS.md) §3. Find the customer id in the Supabase dashboard (Table Editor → `customers`).

```bash
npm run admin:export-customer -- --customer <uuid> --out ~/UstaPlan-exports
```
```bash
npm run admin:delete-customer -- --customer <uuid>
```
```bash
npm run admin:delete-customer -- --customer <uuid> --confirm
```

The export writes `data.json` plus files outside the repository; hand it to the artisan privately, then delete the folder. Delete without `--confirm` is a dry run (counts only). `--confirm` removes the files, then the jobs and everything attached, then the customer; repeat it if it stops halfway. Log the request (date, type, customer id; no names) in your private log.

**Artisan account closure:** deactivate in the panel, offer an export, then delete the user in the Supabase dashboard (Authentication → Users). The cascade removes all of their data; the nightly cleanup removes their files within a day.

## 5. When something looks wrong

| Symptom | Check |
| --- | --- |
| Pushes stopped, *Sistem* says "gecikme ya da hata" | Supabase → Integrations → Cron → `ustaplan-dispatch` runs every 5 min with status 200? Vault secrets `app_base_url` / `cron_secret` match Vercel's `APP_BASE_URL` / `CRON_SECRET`? Vercel logs for `/api/internal/dispatch`. Pushes older than 1 h are skipped, never sent late. |
| One artisan gets no pushes | *Ustalar*: "Bildirim cihazı" 0 → the artisan turns notifications on in Ayarlar (on iPhone only from the Home Screen app). |
| Site down after a deploy | Vercel → Deployments → previous deployment → *Promote to Production* (instant rollback), then fix forward. |
| Dev project paused (Free plan, ~7 idle days) | Supabase dashboard → Restore project. The 5-minute cron keeps an active project awake. |
| Customer says the link doesn't open | The artisan turned the link off or created a new one (old links show the invalid page by design). They can re-share from the job. |

## 6. Secrets

| Secret | Where | Rotating it |
| --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Vercel (Production), `.env.local` | Create a new secret key in Supabase, update Vercel, redeploy, then revoke the old one. |
| `SHARE_LINK_SECRET` | Vercel | **Invalidates every customer link.** Only if leaked. |
| `CRON_SECRET` | Vercel + Vault `cron_secret` | Change both to the same new value (Vault first, Vercel right after); one failed cron cycle at most. |
| `VAPID_PRIVATE_KEY` | Vercel | Changing the key pair breaks existing subscriptions: every artisan re-enables notifications. Only if leaked. |
| `SUPABASE_DB_URL` | `.env.local` only (backups) | Reset the DB password in Supabase, update `.env.local`. |

Every Vercel env change and every `supabase db push` is a deliberate owner action; the repository is public, so none of these values are ever committed.
