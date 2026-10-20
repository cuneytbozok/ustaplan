# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-20._

## State in one line
Owner request **job notes** (plan N-1) split into N.1–N.3. **N.1 is complete and committed locally, not pushed.** M6.5 and M6.7 stay blocked on the owner. Open owner checks: **D1–D9** (PROGRESS).

## Last completed task
**N.1**: migration `20261020100832_job_notes.sql` (applied to dev with approval): `job_notes` table + RLS, old `jobs.private_note` copied in and the column dropped, `create_job(p_notes text[])`, `note_*` events and `customer_note` category (for N.3). Job page has one **Notlarım** card (written notes with add/edit/"Düzenlendi"/delete-with-confirmation, plus the voice notes as before). `actions/notes.ts`, `components/notes/job-notes.tsx`.

## Current or interrupted task
None. **N.2** (notes in Yeni iş, voice recordings kept in memory and uploaded after create, retry on failure) and **N.3** (customer notes on `/t/<token>`, open jobs only; "Müşteri notları"; `customer_note` notification) are Pending; the design is in plan §15 N-1.

## Key decisions
- N-1 (owner, 2026-10-20): migrate and remove the old single note; customers may write/edit/delete notes only while the job is open. Customer notes = plain admin CRUD in route handlers (no new RPC), rate limits counted from rows, `note_*` audit events without text.
- Until N.2, Yeni iş still has one "Özel not" field; it is saved as the first note through `p_notes`.
- Earlier decisions (admin panel, customer links, push, reschedule, etc.) unchanged; see plan §15.

## Tests executed
security-check **317/317** (local production build :3200); typecheck, lint, test 31/31, build pass. Browser smoke at 360 px with fake account C (fake job/customer deleted afterwards).

## Known bugs and blockers
- **Deploy gap:** the live app (old code) still selects `jobs.private_note`, which no longer exists in dev → job detail/edit pages on ustaplan.vercel.app fail until the N.1 commit is pushed. Push needs owner approval.
- Dev data contains an old fake "hack · hack" job with a pending date request for account C (left by an earlier check run on 2026-10-18); harmless.
- KVKK review open (blocks M6.7); `npm audit` dev-tooling advisories accepted; no Vercel CLI/MCP access (deploys verified over HTTP).

## Environment
Dev Supabase `xytwwudbnykackuxfeif` (Ireland), Vercel `ustaplan` → https://ustaplan.vercel.app (Production on dev data).

## Uncommitted changes
None. The N.1 commit is local only (not pushed).

## Exact next action
Ask the owner to approve `git push` of N.1 (closes the deploy gap). Then, on instruction, start **N.2**.

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
