import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin, readJsonBody, UUID } from "@/lib/customer-api";
import { checkNoteWrite, fail, NOT_FOUND, noteBody, notifyArtisan, TRY_AGAIN, withNoteEvent } from "@/lib/customer-notes";

/** The customer's own note on this job, or null (artisan notes and other jobs' notes never match). */
async function ownNote(verified: NonNullable<Awaited<ReturnType<typeof verifyCustomerToken>>>, noteId: string) {
  const { data, error } = await verified.admin
    .from("job_notes")
    .select("id, body")
    .eq("id", noteId)
    .eq("job_id", verified.jobId)
    .eq("author", "customer")
    .maybeSingle();
  if (error) throw new Error("note lookup failed");
  return data;
}

/** Customer edits one of their notes (plan N-1, N.3); open jobs only. An unchanged text is ok without an event. */
export async function PATCH(request: Request, { params }: RouteContext<"/api/t/[token]/notes/[noteId]">) {
  if (!isSameOrigin(request)) return fail("İstek reddedildi.", 403);
  const { token, noteId } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();
  if (!UUID.test(noteId)) return fail(NOT_FOUND, 404);

  const parsed = noteBody.safeParse(await readJsonBody(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Lütfen notunuzu kontrol edin.");
  const note = await ownNote(verified, noteId);
  if (!note) return fail(NOT_FOUND, 404);
  const check = await checkNoteWrite(verified, { adding: false });
  if ("response" in check) return check.response;
  if (note.body === parsed.data.body) return actionResponse({ ok: true });

  const { admin, jobId, ownerId } = verified;
  const written = await withNoteEvent(verified, "note_updated", noteId, async () => {
    const { data, error } = await admin
      .from("job_notes")
      .update({ body: parsed.data.body })
      .eq("id", noteId)
      .eq("job_id", jobId)
      .eq("author", "customer")
      .select("id");
    return !error && data.length === 1;
  });
  if (!written) return fail(TRY_AGAIN, 500);

  await notifyArtisan(admin, ownerId, jobId, check.job, "updated");
  return actionResponse({ ok: true });
}

/** Customer deletes one of their notes (plan N-1, N.3); open jobs only. No notification, only the audit event. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/t/[token]/notes/[noteId]">) {
  if (!isSameOrigin(request)) return fail("İstek reddedildi.", 403);
  const { token, noteId } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();
  if (!UUID.test(noteId)) return fail(NOT_FOUND, 404);

  if (!(await ownNote(verified, noteId))) return fail(NOT_FOUND, 404);
  const check = await checkNoteWrite(verified, { adding: false });
  if ("response" in check) return check.response;

  const { admin, jobId } = verified;
  const written = await withNoteEvent(verified, "note_deleted", noteId, async () => {
    const { data, error } = await admin.from("job_notes").delete().eq("id", noteId).eq("job_id", jobId).eq("author", "customer").select("id");
    return !error && data.length === 1;
  });
  if (!written) return fail("Silinemedi. Lütfen tekrar deneyin.", 500);
  return actionResponse({ ok: true });
}
