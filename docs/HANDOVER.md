# Handover — UstaPlan

_Rewritten at the end of every task. Last updated: 2026-10-20._

## State in one line
Owner request **job notes** (plan N-1) is complete: **N.1–N.3 committed locally, not pushed.** M6.5 and M6.7 stay blocked on the owner. Open owner checks: **D1–D9** (PROGRESS).

## Last completed task
**N.3**: customers add / edit / delete their own written notes on `/t/<token>` while the job is open (read-only afterwards): `api/t/[token]/notes` (+ `/[noteId]`), `lib/customer-notes.ts`, `components/public/customer-notes.tsx`, `CustomerJobView.notes` + `capabilities.writeNotes`. Artisan sees a separate read-only **Müşteri notları** card and a daily `customer_note` inbox item (first one pushed).
Before that **N.2** (notes while creating a job; recordings uploaded after create with retry) and **N.1** (migration `job_notes`, Notlarım card, old `private_note` migrated and dropped).

## Current or interrupted task
None.

## Key decisions
- N-1 (owner, 2026-10-20): migrate and remove the old single note; customers write notes only while the job is open. Customer notes = plain admin CRUD in route handlers (no new RPC), limits counted from rows, `note_*` events without text, event written first and removed if the note write fails.
- Notification: one `customer_note` item per job per Istanbul day; later notes/edits that day increment the count without another push. Deleting a note only leaves the audit event.
- Shared note UI in `components/notes/job-notes.tsx` (`EditableNote`, `AddNote`, `NoteEditor`, `DeleteConfirm`); recorder in `media/voice-notes.tsx` (`VoiceRecorder`, `uploadVoiceNote`).

## Tests executed
security-check **355/355** (local production build :3200); typecheck, lint, test 32/32, build pass. Browser flows at 360 px with fake account C for all three tasks (fake data removed). The pane has no microphone: N.2 recording was tested with a generated tone; the "drafts locked after a failed upload" view was checked by code only. Not tested on a real phone yet.

## Known bugs and blockers
- **Deploy gap:** the live app (old code) still selects `jobs.private_note`, which no longer exists in dev → job detail/edit pages on ustaplan.vercel.app fail until N.1–N.3 are pushed. Push needs owner approval.
- Dev data has an old fake "hack · hack" job with a pending date request for account C (from a 2026-10-18 check run); harmless.
- KVKK review open (blocks M6.7); `npm audit` dev-tooling advisories accepted; no Vercel CLI/MCP access (deploys verified over HTTP).

## Environment
Dev Supabase `xytwwudbnykackuxfeif` (Ireland), Vercel `ustaplan` → https://ustaplan.vercel.app (Production on dev data).

## Uncommitted changes
None. Commits N.1, N.2, N.3 are local only.

## Exact next action
Ask the owner to approve `git push` (closes the deploy gap), then check `/isler/<id>` and a customer link on the deployed URL and on a phone (record a real voice note in Yeni iş; customer note → push on the artisan's phone).

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
