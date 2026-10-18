import { randomUUID } from "node:crypto";
import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin } from "@/lib/customer-api";
import { istanbulDateKey } from "@/lib/domain/time";

const BUCKET = "job-images";
const MAX_BYTES = 2 * 1024 * 1024;
// Multipart overhead on top of the 2 MB image; anything bigger is refused unread.
const MAX_REQUEST_BYTES = MAX_BYTES + 64 * 1024;
const MAX_UPLOADS_PER_HOUR = 10;
const MAX_ACTIVE_PHOTOS = 20;

const fail = (error: string, status = 400) => actionResponse({ ok: false, error }, status);

/**
 * Customer adds a photo to the job (spec §5.4, plan §5/§6). Order: Origin →
 * token → job state → rate limits → size + JPEG magic bytes → store the object
 * → insert the row (object removed again if that fails) → link_holder event →
 * the artisan's daily customer_photo_added inbox item. The browser has already
 * re-encoded the image (≤ 1600 px JPEG, no EXIF/GPS); the server trusts nothing
 * but checks bytes, not the declared type. Limits are per job and counted from
 * job_media, so concurrent requests can overshoot by a request or two.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/t/[token]/photos">) {
  if (!isSameOrigin(request)) return fail("İstek reddedildi.", 403);

  const { token } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();
  const { admin, jobId, ownerId } = verified;

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("status, title, customers(name)")
    .eq("id", jobId)
    .single();
  if (jobError) return fail("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.", 500);
  // Capability table (plan §5): every state except cancelled accepts uploads.
  if (job.status === "cancelled") return fail("İptal edilen işe fotoğraf eklenemez.", 409);

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [recent, active] = await Promise.all([
    admin.from("job_media").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("origin", "customer").gte("created_at", hourAgo),
    admin.from("job_media").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("origin", "customer").is("deleted_at", null),
  ]);
  if (recent.error || active.error) return fail("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.", 500);
  if ((recent.count ?? 0) >= MAX_UPLOADS_PER_HOUR) return fail("Bir saatte en fazla 10 fotoğraf eklenebilir. Lütfen biraz sonra tekrar deneyin.", 429);
  if ((active.count ?? 0) >= MAX_ACTIVE_PHOTOS) return fail("Bu işe en fazla 20 fotoğraf eklenebilir. Yenisi için önce birini silin.", 429);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return fail("Fotoğraf en fazla 2 MB olabilir.", 413);
  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("photo");
  } catch {}
  if (!(file instanceof Blob)) return fail("Lütfen bir fotoğraf seçin.");
  if (file.size === 0 || file.size > MAX_BYTES) return fail("Fotoğraf en fazla 2 MB olabilir.", 413);
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return fail("Dosya bir JPEG fotoğrafı değil.");

  // The path is built here from the verified link, never taken from the client.
  const mediaId = randomUUID();
  const path = `${ownerId}/${jobId}/${mediaId}.jpg`;
  const storage = admin.storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(path, file, { contentType: "image/jpeg", upsert: false });
  if (uploadError) return fail("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.", 500);

  const { error: rowError } = await admin.from("job_media").insert({
    id: mediaId,
    owner_user_id: ownerId,
    job_id: jobId,
    kind: "image",
    origin: "customer",
    visibility: "shared",
    storage_bucket: BUCKET,
    storage_path: path,
    mime_type: "image/jpeg",
    size_bytes: file.size,
  });
  const { error: eventError } = rowError
    ? { error: rowError }
    : await admin.from("job_events").insert({
        owner_user_id: ownerId,
        job_id: jobId,
        event_type: "media_added",
        actor_type: "link_holder",
        payload: { media_id: mediaId, kind: "image", origin: "customer" },
      });
  if (eventError) {
    // No audit row, no photo: undo both so nothing unexplained is left.
    await admin.from("job_media").delete().eq("id", mediaId);
    await storage.remove([path]);
    return fail("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.", 500);
  }

  await notifyArtisan(admin, ownerId, jobId, job.title, job.customers?.name ?? "");
  return actionResponse({ ok: true });
}

type Admin = NonNullable<Awaited<ReturnType<typeof verifyCustomerToken>>>["admin"];

/**
 * One inbox item per job per Istanbul day (DATA_MODEL §2): a repeat upload
 * increments payload.count and marks it unread again. No push for photos.
 * The photo is already stored, so a failure here doesn't fail the upload.
 */
async function notifyArtisan(admin: Admin, ownerId: string, jobId: string, title: string, customerName: string) {
  const dedupeKey = `photos:${jobId}:${istanbulDateKey()}`;
  const payload = { job_title: title, customer_first_name: customerName.trim().split(/\s+/)[0] ?? "", count: 1 };
  const inserted = await admin.from("notifications").insert({
    owner_user_id: ownerId,
    job_id: jobId,
    category: "customer_photo_added",
    payload,
    dedupe_key: dedupeKey,
    in_inbox: true,
    push_status: "none",
  });
  if (inserted.error?.code !== "23505") return;

  const { data: existing } = await admin
    .from("notifications")
    .select("id, payload")
    .eq("owner_user_id", ownerId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (!existing) return;
  const previous = (existing.payload as { count?: unknown } | null)?.count;
  await admin
    .from("notifications")
    .update({ payload: { ...payload, count: (typeof previous === "number" ? previous : 1) + 1 }, read_at: null, created_at: new Date().toISOString() })
    .eq("id", existing.id);
}
