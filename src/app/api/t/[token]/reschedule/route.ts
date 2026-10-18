import { after } from "next/server";
import { z } from "zod";
import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin, readJsonBody } from "@/lib/customer-api";
import { istanbulDateTime } from "@/lib/domain/scheduling";
import { deliverNotification } from "@/lib/push";

const requestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  note: z.string().trim().max(500).optional().default(""),
});
const withdrawSchema = z.object({ requestId: z.uuid() });

const TRY_AGAIN = "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
const CHANGED = "Randevu bilgisi değişmiş. Sayfayı yenileyip tekrar deneyin.";

/**
 * Customer asks for a new time for the next appointment (spec §5.2, plan §8).
 * The date and time are Istanbul wall-clock values; the duration stays the
 * same. public_request_reschedule re-checks the link under a row lock, replaces
 * an open negotiation, enforces ≤ 10 requests per job per day and leaves the
 * artisan a notification. The current appointment is untouched until the
 * artisan approves.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/t/[token]/reschedule">) {
  if (!isSameOrigin(request)) return actionResponse({ ok: false, error: "İstek reddedildi." }, 403);
  const { token } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();

  const parsed = requestSchema.safeParse(await readJsonBody(request));
  const startsAt = parsed.success ? istanbulDateTime(parsed.data.date, parsed.data.time) : null;
  if (!parsed.success || !startsAt) return actionResponse({ ok: false, error: "Lütfen tarih ve saat seçin." });

  const { data, error } = await verified.admin.rpc("public_request_reschedule", {
    p_job_id: verified.jobId,
    p_share_version: verified.shareVersion,
    p_starts_at: startsAt.toISOString(),
    p_note: parsed.data.note,
  });
  if (error) return actionResponse({ ok: false, error: TRY_AGAIN }, 500);

  const outcome = data as { result?: string; request_id?: string } | null;
  switch (outcome?.result) {
    case "ok": {
      const requestId = outcome.request_id;
      if (requestId) after(() => deliverNotification(verified.ownerId, `request:${requestId}`));
      return actionResponse({ ok: true });
    }
    case "link_invalid":
      return invalidLink();
    case "invalid_transition":
      return actionResponse({ ok: false, error: CHANGED }, 409);
    case "rate_limited":
      return actionResponse({ ok: false, error: "Bugün için tarih değişikliği isteği sınırına ulaşıldı. Lütfen ustanızı arayın." }, 429);
    default:
      return actionResponse({ ok: false, error: "Lütfen ileri bir tarih ve şu anki randevunuzdan farklı bir saat seçin." });
  }
}

/** Customer withdraws the open request (public_withdraw_request). Repeats are ok. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/t/[token]/reschedule">) {
  if (!isSameOrigin(request)) return actionResponse({ ok: false, error: "İstek reddedildi." }, 403);
  const { token } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();

  const parsed = withdrawSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) return actionResponse({ ok: false, error: CHANGED });

  const { data, error } = await verified.admin.rpc("public_withdraw_request", {
    p_job_id: verified.jobId,
    p_share_version: verified.shareVersion,
    p_request_id: parsed.data.requestId,
  });
  if (error) return actionResponse({ ok: false, error: TRY_AGAIN }, 500);

  const result = (data as { result?: string } | null)?.result;
  if (result === "ok") return actionResponse({ ok: true });
  if (result === "link_invalid") return invalidLink();
  return actionResponse({ ok: false, error: CHANGED }, 409);
}
