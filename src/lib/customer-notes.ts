import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse } from "@/lib/customer-api";
import { OPEN_JOB_STATUSES } from "@/lib/domain/labels";
import { istanbulDateKey } from "@/lib/domain/scheduling";
import { deliverNotification } from "@/lib/push";

// Customer notes (plan N-1, N.3): plain admin CRUD after the link check, like
// customer photos. Limits are counted from rows, so concurrent requests can
// overshoot by a request or two.

type Verified = NonNullable<Awaited<ReturnType<typeof verifyCustomerToken>>>;
type Admin = Verified["admin"];
export type NoteEvent = "note_added" | "note_updated" | "note_deleted";

const MAX_ACTIVE_NOTES = 20;
const MAX_WRITES_PER_HOUR = 20;

export const TRY_AGAIN = "Not kaydedilemedi. Lütfen tekrar deneyin.";
export const NOT_FOUND = "Not bulunamadı.";
export const noteBody = z.object({ body: z.string().trim().min(1, "Lütfen notunuzu yazın.").max(1000, "Not en fazla 1000 karakter olabilir.") });

export const fail = (error: string, status = 400) => actionResponse({ ok: false, error }, status);

/**
 * The job must be open (owner decision N-1: afterwards notes are read-only) and
 * the hourly write limit not reached. Returns the job's title and customer name
 * for the notification, or a ready error response.
 */
export async function checkNoteWrite(verified: Verified, { adding }: { adding: boolean }) {
  const { admin, jobId } = verified;
  const { data: job, error } = await admin.from("jobs").select("status, title, customers(name)").eq("id", jobId).single();
  if (error) return { response: fail(TRY_AGAIN, 500) };
  if (!(OPEN_JOB_STATUSES as readonly string[]).includes(job.status)) {
    return { response: fail("Tamamlanan veya iptal edilen işte notlar değiştirilemez.", 409) };
  }

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [writes, active] = await Promise.all([
    admin
      .from("job_events")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("actor_type", "link_holder")
      .in("event_type", ["note_added", "note_updated", "note_deleted"])
      .gte("created_at", hourAgo),
    adding
      ? admin.from("job_notes").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("author", "customer")
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (writes.error || active.error) return { response: fail(TRY_AGAIN, 500) };
  if ((writes.count ?? 0) >= MAX_WRITES_PER_HOUR) return { response: fail("Çok fazla işlem yapıldı. Lütfen biraz sonra tekrar deneyin.", 429) };
  if ((active.count ?? 0) >= MAX_ACTIVE_NOTES) return { response: fail(`Bu işe en fazla ${MAX_ACTIVE_NOTES} not eklenebilir. Yenisi için önce birini silin.`, 429) };
  return { job: { title: job.title, customerName: job.customers?.name ?? "" } };
}

/**
 * Audit first, then the write (plan §5: every customer write has an event).
 * If the write fails or changes nothing, the event is removed again.
 */
export async function withNoteEvent(verified: Verified, event: NoteEvent, noteId: string, write: () => Promise<boolean>) {
  const { admin, jobId, ownerId } = verified;
  const eventId = randomUUID();
  const { error } = await admin.from("job_events").insert({
    id: eventId,
    owner_user_id: ownerId,
    job_id: jobId,
    event_type: event,
    actor_type: "link_holder",
    payload: { note_id: noteId },
  });
  if (error) return false;
  const written = await write().catch(() => false);
  if (!written) await admin.from("job_events").delete().eq("id", eventId);
  return written;
}

/**
 * One customer_note inbox item per job per Istanbul day (DATA_MODEL §2). The
 * first one of the day is pushed at once; later notes or edits that day
 * increment payload.count and mark it unread again without another push.
 * The note is already stored, so a failure here doesn't fail the request.
 */
export async function notifyArtisan(admin: Admin, ownerId: string, jobId: string, job: { title: string; customerName: string }, action: "added" | "updated") {
  const dedupeKey = `notes:${jobId}:${istanbulDateKey(new Date())}`;
  const payload = { job_title: job.title, customer_first_name: job.customerName.trim().split(/\s+/)[0] ?? "", count: 1, action };
  const inserted = await admin.from("notifications").insert({
    owner_user_id: ownerId,
    job_id: jobId,
    category: "customer_note",
    payload,
    dedupe_key: dedupeKey,
    in_inbox: true,
    push_status: "pending",
    push_next_attempt_at: new Date().toISOString(),
  });
  if (!inserted.error) {
    after(() => deliverNotification(ownerId, dedupeKey));
    return;
  }
  if (inserted.error.code !== "23505") return;

  const { data: existing } = await admin.from("notifications").select("id, payload").eq("owner_user_id", ownerId).eq("dedupe_key", dedupeKey).maybeSingle();
  if (!existing) return;
  const previous = (existing.payload as { count?: unknown } | null)?.count;
  await admin
    .from("notifications")
    .update({ payload: { ...payload, count: (typeof previous === "number" ? previous : 1) + 1 }, read_at: null, created_at: new Date().toISOString() })
    .eq("id", existing.id);
}
