# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-20._

## State in one line
Owner requests **N-1 (job notes)** deployed (`2f6fd46`) and **U-1 (UI polish)** complete and committed locally, **not pushed**. M6.5 and M6.7 stay blocked on the owner. Open owner checks: **D1–D9** (PROGRESS).

## Last completed task
**U.1** (plan U-1): compact sub-page header (`PageHeader backHref`); Yeni iş customer selector (`components/jobs/customer-picker.tsx`: name/phone search, ≤ 6 results, recents, Değiştir, Yeni müşteri always visible, no-match → new customer prefilled, `?musteri=` preselect); Diğer detaylar chevron, `PRICE_HINTS` (also İşi düzenle), private notes as auto-growing fields submitted with the job (`common/auto-grow-textarea.tsx`), "Adres ekle" in a bottom sheet with the existing `AddressForm`; Bugün one-line visit time and "Ziyaret gecikti" badge for overdue visits; Müşteri compact address/phone empty states; İşler card date labelled under the badge.

## Current or interrupted task
None.

## Key decisions
- U-1: the İşler card date stays the one the list is sorted by (open: `updated_at` → "Güncellendi", completed/cancelled → their dates), labelled instead of switched to the creation date.
- U-1: new-job notes are plain form fields now (no per-note "Kaydet"), because typed-but-unsaved drafts were lost on "İşi kaydet".
- N-1 decisions unchanged (see plan §15).

## Tests executed
security-check **355/355**, typecheck, lint, test 32/32, build pass. Browser flows at 360 px (local production build, fake account C, fake U1 customer deleted afterwards). Not yet tried on a real phone.

## Known bugs and blockers
- Dev data has an old fake "hack · hack" job with a pending date request for account C; harmless.
- KVKK review open (blocks M6.7); `npm audit` dev-tooling advisories accepted; no Vercel CLI/MCP access (deploys verified over HTTP).

## Environment
Dev Supabase `xytwwudbnykackuxfeif` (Ireland), Vercel `ustaplan` → https://ustaplan.vercel.app (Production on dev data).

## Uncommitted changes
None. The U.1 commit is local only.

## Exact next action
Ask the owner to approve `git push` of U.1; then the owner tests notes + U.1 on the phones.

## Resume commands
```bash
cd /Users/cuneytbozok/Documents/Projeler/Ustaplan
```
```bash
git status && git log --oneline -10
```
```bash
npm ci && npm run typecheck && npm run lint && npm test
```
Security check: `npm run build`, start `prod-check` (.claude/launch.json), then
```bash
APP_BASE_URL=http://localhost:3200 SECURITY_CHECK_BASE_URL=http://localhost:3200 npm run security-check
```
