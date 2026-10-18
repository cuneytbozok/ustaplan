import { after } from "next/server";
import { z } from "zod";
import { verifyCustomerToken } from "@/lib/customer-link";
import { actionResponse, invalidLink, isSameOrigin, readJsonBody } from "@/lib/customer-api";
import { CANCEL_REASON_LABELS, type CancelReason } from "@/lib/domain/labels";
import { deliverNotification } from "@/lib/push";

const schema = z
  .object({
    reason: z.enum(Object.keys(CANCEL_REASON_LABELS) as [CancelReason, ...CancelReason[]]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .refine((v) => v.reason !== "other" || v.note.length > 0, { path: ["note"] });

/**
 * Customer cancels the job (spec §5.3, plan §7 J6). Order: Origin → token →
 * body → public_cancel_job, which re-checks the link under a row lock and does
 * the cascade, the link_holder event and the artisan's notification in one
 * transaction. No separate rate limit: only the first call on an open job
 * changes anything, repeats are no-ops, and cancelling again needs the
 * artisan to reopen the job first.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/t/[token]/cancel">) {
  if (!isSameOrigin(request)) return actionResponse({ ok: false, error: "İstek reddedildi." }, 403);

  const { token } = await params;
  const verified = await verifyCustomerToken(token);
  if (!verified) return invalidLink();

  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    const noteMissing = parsed.error.issues.some((issue) => issue.path[0] === "note");
    return actionResponse({ ok: false, error: noteMissing ? "Lütfen kısa bir açıklama yazın." : "Lütfen bir iptal sebebi seçin." });
  }

  const { data, error } = await verified.admin.rpc("public_cancel_job", {
    p_job_id: verified.jobId,
    p_share_version: verified.shareVersion,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) return actionResponse({ ok: false, error: "İptal kaydedilemedi. Lütfen tekrar deneyin." }, 500);

  const result = (data as { result?: string } | null)?.result;
  if (result === "ok") {
    // Immediate push (plan §9): after the response, independent of cron. A repeat finds it already sent.
    after(() => deliverNotification(verified.ownerId, `cancel:${verified.jobId}`));
    return actionResponse({ ok: true });
  }
  if (result === "link_invalid") return invalidLink();
  if (result === "invalid_transition") return actionResponse({ ok: false, error: "Bu iş artık iptal edilemiyor." }, 409);
  return actionResponse({ ok: false, error: "Lütfen bir iptal sebebi seçin." });
}
