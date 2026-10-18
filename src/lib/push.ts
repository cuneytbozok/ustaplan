import "server-only";
import webpush, { WebPushError } from "web-push";
import { pushEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderNotification } from "@/lib/push/render";

/** What the service worker shows (public/sw.js): url is a same-origin path, tag the dedupe key. */
export type PushMessage = { title: string; body: string; url: string; tag: string };

export type PushResult = { sent: number; failed: number; removed: number };

const MAX_FAILURES = 5;

let configured = false;
function configure() {
  if (configured) return;
  const { subject, publicKey, privateKey } = pushEnv();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Sends one message to an artisan's devices (plan §9), or to one device when
 * `endpoint` is given. Uses the admin client: callers have already decided
 * the artisan may receive it. Dead subscriptions are removed (404/410, or 5
 * failures in a row); success resets the failure count. Never logs endpoints
 * or keys: they identify the device.
 */
export async function sendPush(ownerId: string, message: PushMessage, endpoint?: string): Promise<PushResult> {
  configure();
  const admin = createAdminClient();
  let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, failure_count").eq("owner_user_id", ownerId);
  if (endpoint) query = query.eq("endpoint", endpoint);
  const { data: subscriptions, error } = await query;
  if (error) throw new Error("push subscriptions lookup failed");

  const result: PushResult = { sent: 0, failed: 0, removed: 0 };
  const payload = JSON.stringify(message);
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 24 * 60 * 60,
          urgency: "high",
        });
        result.sent++;
        await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", s.id);
      } catch (e) {
        result.failed++;
        const status = e instanceof WebPushError ? e.statusCode : 0;
        if (status === 404 || status === 410 || s.failure_count + 1 >= MAX_FAILURES) {
          result.removed++;
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          await admin.from("push_subscriptions").update({ failure_count: s.failure_count + 1 }).eq("id", s.id);
        }
        console.error(`web push failed (status ${status || "network"})`);
      }
    }),
  );
  return result;
}

const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = [5, 15];

/**
 * Sends one inbox/outbox notification (plan §9). Claims it first with a
 * conditional update (pending|failed → sending), so a concurrent sender (the
 * M5.8 dispatcher) can't send it twice. Then: sent (≥ 1 device accepted it),
 * skipped (the artisan has no device), or failed with the next retry time
 * (none after 3 attempts). Copy comes from render.ts; tapping opens the job.
 */
export async function deliverNotification(ownerId: string, dedupeKey: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("notifications")
    .select("id, job_id, category, payload, push_attempts")
    .eq("owner_user_id", ownerId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (!row) return;

  const attempts = row.push_attempts + 1;
  const { data: claimed } = await admin
    .from("notifications")
    .update({ push_status: "sending", push_attempts: attempts })
    .eq("id", row.id)
    .in("push_status", ["pending", "failed"])
    .select("id");
  if (!claimed?.length) return; // already sent, being sent, or not a push

  let status: "sent" | "skipped" | "failed" = "failed";
  try {
    const { title, body } = renderNotification(row.category, row.payload);
    const result = await sendPush(ownerId, {
      title,
      body,
      url: row.job_id ? `/isler/${row.job_id}` : "/bildirimler",
      tag: dedupeKey,
    });
    status = result.sent ? "sent" : result.failed ? "failed" : "skipped";
  } catch {
    status = "failed";
  }

  const retryIn = RETRY_MINUTES[attempts - 1];
  await admin
    .from("notifications")
    .update({
      push_status: status,
      pushed_at: status === "sent" ? new Date().toISOString() : null,
      push_next_attempt_at:
        status === "failed" && attempts < MAX_ATTEMPTS && retryIn ? new Date(Date.now() + retryIn * 60_000).toISOString() : null,
    })
    .eq("id", row.id);
}
