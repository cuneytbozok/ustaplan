import { z } from "zod";
import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin, readJsonBody } from "@/lib/customer-api";

const schema = z.object({ requestId: z.uuid() });
const CHANGED = "Randevu bilgisi değişmiş. Sayfayı yenileyip tekrar deneyin.";

/**
 * Customer accepts the artisan's counter-offer (plan §8): public_accept_counter
 * swaps the appointments atomically and leaves the artisan a notification.
 * A counter whose time has passed is refused; repeats return ok.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/t/[token]/reschedule/accept">) {
  if (!isSameOrigin(request)) return actionResponse({ ok: false, error: "İstek reddedildi." }, 403);
  const { token } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) return actionResponse({ ok: false, error: CHANGED });

  const { data, error } = await verified.admin.rpc("public_accept_counter", {
    p_job_id: verified.jobId,
    p_share_version: verified.shareVersion,
    p_request_id: parsed.data.requestId,
  });
  if (error) return actionResponse({ ok: false, error: "İşlem tamamlanamadı. Lütfen tekrar deneyin." }, 500);

  const result = (data as { result?: string } | null)?.result;
  if (result === "ok") return actionResponse({ ok: true });
  if (result === "link_invalid") return invalidLink();
  if (result === "expired") return actionResponse({ ok: false, error: "Önerilen saat geçti. Lütfen yeni bir tarih isteyin." }, 409);
  return actionResponse({ ok: false, error: CHANGED }, 409);
}
