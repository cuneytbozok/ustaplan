import { randomUUID } from "node:crypto";
import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin, readJsonBody } from "@/lib/customer-api";
import { checkNoteWrite, fail, noteBody, notifyArtisan, TRY_AGAIN, withNoteEvent } from "@/lib/customer-notes";

/**
 * Customer adds a written note to the job (plan N-1, N.3). Order: Origin →
 * token → body → job open + limits → note_added event → the note (event
 * removed again if that fails) → the artisan's daily customer_note item.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/t/[token]/notes">) {
  if (!isSameOrigin(request)) return fail("İstek reddedildi.", 403);
  const { token } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();

  const parsed = noteBody.safeParse(await readJsonBody(request));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Lütfen notunuzu kontrol edin.");
  const check = await checkNoteWrite(verified, { adding: true });
  if ("response" in check) return check.response;

  const { admin, jobId, ownerId } = verified;
  const noteId = randomUUID();
  const written = await withNoteEvent(verified, "note_added", noteId, async () => {
    const { error } = await admin.from("job_notes").insert({ id: noteId, owner_user_id: ownerId, job_id: jobId, author: "customer", body: parsed.data.body });
    return !error;
  });
  if (!written) return fail(TRY_AGAIN, 500);

  await notifyArtisan(admin, ownerId, jobId, check.job, "added");
  return actionResponse({ ok: true });
}
