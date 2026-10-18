import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin, UUID } from "@/lib/customer-api";

const NOT_FOUND = "Fotoğraf bulunamadı.";

/**
 * Customer deletes one of the customer-origin photos of this job (spec §5.4).
 * Artisan photos are never deletable through the link. Allowed in every job
 * state, cancelled included (plan §5). Soft-deletes the row, removes the
 * object, writes a link_holder event. Repeating a delete that already happened
 * returns ok without a second event.
 */
export async function DELETE(request: Request, { params }: RouteContext<"/api/t/[token]/photos/[mediaId]">) {
  if (!isSameOrigin(request)) return actionResponse({ ok: false, error: "İstek reddedildi." }, 403);

  const { token, mediaId } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();
  if (!UUID.test(mediaId)) return actionResponse({ ok: false, error: NOT_FOUND }, 404);
  const { admin, jobId, ownerId } = verified;

  const { data: media, error } = await admin
    .from("job_media")
    .select("storage_bucket, storage_path, deleted_at")
    .eq("id", mediaId)
    .eq("job_id", jobId)
    .eq("kind", "image")
    .eq("origin", "customer")
    .maybeSingle();
  if (error) return actionResponse({ ok: false, error: "Silinemedi. Lütfen tekrar deneyin." }, 500);
  if (!media) return actionResponse({ ok: false, error: NOT_FOUND }, 404);
  if (media.deleted_at) return actionResponse({ ok: true });

  // The conditional update makes a concurrent second delete a no-op.
  const { data: updated, error: updateError } = await admin
    .from("job_media")
    .update({ deleted_at: new Date().toISOString(), deleted_by: "link_holder" })
    .eq("id", mediaId)
    .is("deleted_at", null)
    .select("id");
  if (updateError) return actionResponse({ ok: false, error: "Silinemedi. Lütfen tekrar deneyin." }, 500);
  if (!updated.length) return actionResponse({ ok: true });

  // Orphans left by a failed remove are cleaned up by the daily dispatcher (plan §6).
  await admin.storage.from(media.storage_bucket).remove([media.storage_path]);
  await admin.from("job_events").insert({
    owner_user_id: ownerId,
    job_id: jobId,
    event_type: "media_deleted",
    actor_type: "link_holder",
    payload: { media_id: mediaId, kind: "image", origin: "customer" },
  });
  return actionResponse({ ok: true });
}
