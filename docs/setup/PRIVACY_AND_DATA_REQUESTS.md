# Privacy (KVKK) and Personal-Data Requests — Pilot

**Status:** Pilot process. The notice text below is a draft and **should be reviewed by a qualified KVKK advisor before real customer data is processed.** This is not legal advice.

## 1. Roles and data

| Who | KVKK role (assumed) | Data |
| --- | --- | --- |
| Tradesperson (usta) | Data controller (*veri sorumlusu*) for their customers | Customer name, phone, addresses, job details, photos, notes, voice notes, appointment times, cancellation reasons |
| UstaPlan operator (administrator) | Data processor (*veri işleyen*) on the tradesperson's behalf; data controller for the tradesperson's own account data | Tradesperson email, name, business name, contact phone, push subscriptions |
| Infrastructure | Sub-processors | Supabase (database/storage, EU – Frankfurt), Vercel (hosting) |

Data minimisation already built into the design:
- The customer page never shows the customer's phone, address, other jobs, notes, audio, private photos, or the estimated price.
- Photos are re-encoded in the browser, which removes EXIF and GPS data.
- There are no analytics, no third-party scripts, and no tokens in application logs.

**Open legal point:** both providers store data outside Turkey. Under KVKK Art. 9 (as amended in 2024), transfers abroad generally need a valid transfer mechanism, such as standard contractual clauses notified to the Authority. Resolve this with an advisor before the pilot uses real customer data.

## 2. Customer-facing notice (draft, Turkish)

Served at `/gizlilik` and linked from every customer job page as "Kişisel verileriniz". Keep it short.

> **Kişisel verileriniz hakkında**
>
> Bu sayfa, işinizi kaydeden usta tarafından UstaPlan aracılığıyla sizinle paylaşılmıştır. Adınız, telefon numaranız, adresiniz, işe ait bilgiler, randevu tarihleri ve bu sayfadan yüklediğiniz fotoğraflar yalnızca işinizin planlanması ve yürütülmesi amacıyla ustanız tarafından işlenir. Bu verilerin sorumlusu ustanızdır; UstaPlan yalnızca hizmeti sağlar.
>
> Telefon numaranız ve adresiniz bu sayfada gösterilmez. Fotoğraflarınızdaki konum bilgisi yükleme sırasında silinir. Veriler, hizmet sağlayıcılarımızın Avrupa Birliği'ndeki sunucularında saklanır ve üçüncü kişilerle reklam veya pazarlama amacıyla paylaşılmaz.
>
> KVKK'nın 11. maddesi kapsamındaki haklarınızı (bilgi talep etme, düzeltme, silme vb.) kullanmak için ustanızla iletişime geçebilirsiniz. Talebiniz en geç 30 gün içinde sonuçlandırılır.

## 3. Handling a deletion or access request (manual)

1. **Receive.** The customer contacts the tradesperson, or rarely the administrator. The tradesperson forwards the request to the administrator with the job or customer name. Do not send the data itself over chat.
2. **Verify.** The tradesperson confirms the requester is that customer, for example by calling the phone number on record. No ID documents are collected.
3. **Identify.** The administrator finds the `customer_id` in the Supabase dashboard (Table Editor → `customers`, filtered by the tradesperson).
4. **Dry run.** `npx tsx scripts/delete-customer-data.ts --customer <uuid>` lists what will be removed (number of jobs, appointments, media files, events, notifications) without changing anything.
5. **Execute.** Re-run with `--confirm`. The script removes the storage objects first, then deletes the customer row and everything that cascades from it (jobs, appointments, requests, media rows, events, notifications) in one transaction. It is safe to repeat if interrupted.
6. **Access requests.** `scripts/export-customer-data.ts --customer <uuid>` produces a JSON summary plus photo files for the tradesperson to hand over.
7. **Record.** Add a line to a private request log kept outside the repository: date, request type, pseudonymous customer id, completed date. Never record the customer's name or phone in the repository.
8. **Respond** within 30 days (KVKK Art. 13).
9. **Backups.** Local backups (`scripts/backup.sh`) are kept for at most 4 weeks, so erased data leaves backups within that period. Never restore a backup without re-applying erasures recorded in the request log.

## 4. Tradesperson account closure

The administrator disables sign-in (Supabase dashboard → Users → ban user), agrees an export with the tradesperson if they want one, then deletes the auth user. Deleting it cascades the profile and all of that tradesperson's data, and the script removes their storage folder.
