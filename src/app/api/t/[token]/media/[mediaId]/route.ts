import { verifyCustomerToken } from "@/lib/customer-link";
import { INVALID_LINK_MESSAGE } from "@/components/public/invalid-link";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

const invalid = () =>
  new Response(INVALID_LINK_MESSAGE, { status: 404, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Token-verified media proxy (plan §5, P-10): re-checks the link on every
 * request, so revoking or regenerating it cuts access immediately. Only shared
 * artisan photos and customer photos of that job; never private photos or audio.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/t/[token]/media/[mediaId]">) {
  const { token, mediaId } = await params;
  if (!UUID.test(mediaId)) return invalid();
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalid();

  const { data: media } = await verified.admin
    .from("job_media")
    .select("storage_bucket, storage_path, mime_type, origin, visibility")
    .eq("id", mediaId)
    .eq("job_id", verified.jobId)
    .eq("kind", "image")
    .is("deleted_at", null)
    .maybeSingle();
  if (!media || !(media.origin === "customer" || media.visibility === "shared")) return invalid();

  const { data: file } = await verified.admin.storage.from(media.storage_bucket).download(media.storage_path);
  if (!file) return invalid();
  return new Response(file, {
    headers: { ...PRIVATE_HEADERS, "Content-Type": media.mime_type, "Content-Disposition": "inline" },
  });
}
