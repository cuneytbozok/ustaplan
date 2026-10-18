import "server-only";
import webpush, { WebPushError } from "web-push";
import { pushEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

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
