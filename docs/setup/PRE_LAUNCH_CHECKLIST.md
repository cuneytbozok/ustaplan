# Pre-launch checklist (before real customer data)

Everything the owner set aside until the app is otherwise finished. Nothing here blocks development on the dev project (fake data only). **All of it must be done before M6.7**, when the prod project starts holding real customers. Tick items here as they're done and record the result in [PROGRESS.md](../PROGRESS.md).

This is a to-do list, not legal advice: the KVKK items need a qualified advisor.

## 1. KVKK and the privacy notice (gizlilik)

- [ ] **Legal review of the notice.** A KVKK advisor reviews the Turkish text at `/gizlilik` (draft in [PRIVACY_AND_DATA_REQUESTS.md](PRIVACY_AND_DATA_REQUESTS.md) §2; code: `src/app/gizlilik/page.tsx`). Apply their changes in the app and the doc together.
- [ ] **Roles confirmed.** The assumed split: each artisan is the data controller (*veri sorumlusu*) for their customers, and the UstaPlan operator is the processor (*veri işleyen*) and the controller for artisans' own account data (privacy doc §1). Ask the advisor to confirm it.
- [ ] **Transfer abroad (KVKK Art. 9).** Supabase (prod: Frankfurt) and Vercel store data outside Turkey. Agree a valid transfer mechanism with the advisor (e.g. standard contractual clauses notified to the Authority) and collect the providers' data processing terms.
- [ ] **Agreement with each artisan.** Ask the advisor whether a short processing agreement or terms of use is needed between the operator and each pilot artisan, and what it should say.
- [ ] **Other registrations or obligations.** Ask the advisor whether anything else applies to the operator or the artisans at pilot scale (for example VERBİS) and record the answer here.
- [ ] **Request log.** Create the private log for data requests outside the repository (date, type, customer id, completed date; never names or phones), per privacy doc §3.7.
- [ ] **Process understood.** Read privacy doc §3–4 and RUNBOOK §4: export (`admin:export-customer`), erasure (`admin:delete-customer`), 30-day response time.

## 2. Backups (D9)

- [ ] Install `pg_dump`: `brew install libpq && brew link --force libpq`.
- [ ] Add `SUPABASE_DB_URL` to `.env.local`: dashboard → **Connect** → Session pooler URI, with the database password (prod project once it exists).
- [ ] Run `scripts/backup.sh ~/UstaPlan-backups` once and check the folder has `db.dump` and `storage/`.
- [ ] Put the weekly backup in the calendar. Keep the backup folder on the Mac's encrypted disk and never share it. Backups older than 4 weeks are deleted automatically (needed for erasure requests).

## 3. Accounts and security settings

- [ ] **Leaked-password protection** (Supabase Auth, HaveIBeenPwned check): decide on it. It may need a paid plan; the Supabase advisor currently warns about it.
- [ ] **Signup disabled** in the prod project's Auth settings (verify with a signup attempt).
- [ ] **Admin account in prod**: `npm run admin:create-admin -- --email <you>`, sign in, set up the authenticator, change the password.

## 4. Hosting terms

- [ ] **Vercel Hobby is non-commercial only.** Move to an eligible plan (e.g. Pro) before any commercial use, including a pilot that counts as commercial. Check Supabase Free's limits for the pilot too.

## 5. Final checks before M6.7

- [ ] **Phone tests:** M6.5 scenarios S1–S11 and D1–D7 in PROGRESS, on an iPhone and an Android phone.
- [ ] **M6.7 steps**, each approved separately: create the prod project in Frankfurt, push the migrations, store the Vault secrets, switch the Vercel env to prod, create the pilot artisans in the panel, then a prod smoke test (setup checklist, RUNBOOK §3 steps 1 and 5).
