import "server-only";
import webpush, { WebPushError } from "web-push";
import { pushEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderNotification } from "@/lib/push/render";
import { notificationTarget } from "@/lib/push/target";

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
// A claim holds the row this long; a sender killed mid-way frees it for the dispatcher.
const LEASE_MINUTES = 10;
// A pending push older than this is stale (after() never ran, or the row
// predates push): it is marked skipped, never sent late. Retries of rows that
// did get a first attempt follow RETRY_MINUTES instead.
const MAX_PENDING_AGE_MINUTES = 60;

type Admin = ReturnType<typeof createAdminClient>;
type OutboxRow = {
  id: string;
  owner_user_id: string;
  job_id: string | null;
  request_id: string | null;
  category: string;
  payload: unknown;
  dedupe_key: string;
  push_attempts: number;
};
const OUTBOX_COLUMNS = "id, owner_user_id, job_id, request_id, category, payload, dedupe_key, push_attempts";

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

/**
 * Claim with a conditional update (plan §9): only one sender gets the row
 * back. `claimable` is the PostgREST filter the row must still match.
 */
async function claim(admin: Admin, row: OutboxRow, claimable: string) {
  const { data } = await admin
    .from("notifications")
    .update({ push_status: "sending", push_attempts: row.push_attempts + 1, push_next_attempt_at: minutesFromNow(LEASE_MINUTES) })
    .eq("id", row.id)
    .or(claimable)
    .select("id");
  return Boolean(data?.length);
}

/** Send a claimed row and record sent / skipped / failed (+ next retry, none after 3 attempts). */
async function sendClaimed(admin: Admin, row: OutboxRow) {
  const attempts = row.push_attempts + 1;
  const payload = (row.payload ?? {}) as { starts_at?: unknown };
  // A reminder for a visit that has started is pointless.
  const expired = row.category === "appointment_reminder" && typeof payload.starts_at === "string" && Date.parse(payload.starts_at) <= Date.now();

  let status: "sent" | "skipped" | "failed" = "skipped";
  if (!expired) {
    try {
      const { title, body } = renderNotification(row.category, row.payload);
      const result = await sendPush(row.owner_user_id, { title, body, ...notificationTarget(row, row.dedupe_key) });
      status = result.sent ? "sent" : result.failed ? "failed" : "skipped";
    } catch {
      status = "failed";
    }
  }

  const retryIn = RETRY_MINUTES[attempts - 1];
  await admin
    .from("notifications")
    .update({
      push_status: status,
      pushed_at: status === "sent" ? new Date().toISOString() : null,
      push_next_attempt_at: status === "failed" && attempts < MAX_ATTEMPTS && retryIn ? minutesFromNow(retryIn) : null,
    })
    .eq("id", row.id);
  return status;
}

/**
 * Immediate push for one notification the request just created (plan §9,
 * via after()). Repeats find it already claimed or sent. Copy comes from
 * render.ts; the target from target.ts.
 */
export async function deliverNotification(ownerId: string, dedupeKey: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("notifications")
    .select(OUTBOX_COLUMNS)
    .eq("owner_user_id", ownerId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (!row) return;
  if (await claim(admin, row, "push_status.in.(pending,failed)")) await sendClaimed(admin, row);
}

/**
 * Dispatcher step (plan §9, M5.8): send everything due. Pending rows newer
 * than 1 h, failed rows whose retry time has come, and rows stuck in
 * "sending" past their lease. Older pending rows are marked skipped.
 */
export async function sendDue() {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const tooOld = new Date(Date.now() - MAX_PENDING_AGE_MINUTES * 60_000).toISOString();

  const { data: stale } = await admin
    .from("notifications")
    .update({ push_status: "skipped", push_next_attempt_at: null })
    .eq("push_status", "pending")
    .lt("created_at", tooOld)
    .select("id");

  const due = `push_status.eq.pending,and(push_status.in.(failed,sending),push_next_attempt_at.lte.${now})`;
  const { data: rows, error } = await admin.from("notifications").select(OUTBOX_COLUMNS).or(due).order("created_at").limit(200);
  if (error) throw new Error("outbox lookup failed");

  const counts = { sent: 0, skipped: 0, failed: 0, expired: stale?.length ?? 0 };
  for (const row of rows) {
    if (!(await claim(admin, row, due))) continue;
    counts[await sendClaimed(admin, row)]++;
  }
  return counts;
}
