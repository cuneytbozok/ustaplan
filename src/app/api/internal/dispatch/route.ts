import { createHash, timingSafeEqual } from "node:crypto";
import { cleanupStorage, createDigests, createReminders } from "@/lib/dispatch";
import { cronEnv } from "@/lib/env";
import { sendDue } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

// One cycle can send a few dozen pushes and walk storage at night.
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** Constant-time comparison of the bearer token with CRON_SECRET (hashed to equal length first). */
function authorized(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return token.length > 0 && timingSafeEqual(digest(token), digest(cronEnv().secret));
}

async function step<T>(name: string, run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    console.error(`dispatch ${name} failed: ${error instanceof Error ? error.message : "unknown"}`);
    return "error" as const;
  }
}

/**
 * Supabase Cron calls this every 5 minutes (DATA_MODEL §7) with the Vault
 * secret as bearer. Creates due reminders and today's digest, sends every due
 * push (new, retries, stuck "sending" rows), and at night cleans up storage.
 * Each step is isolated; the response holds counts only.
 */
export async function POST(request: Request) {
  let ok: boolean;
  try {
    ok = authorized(request);
  } catch {
    return new Response("Dispatcher not configured", { status: 503, headers: NO_STORE }); // CRON_SECRET missing
  }
  if (!ok) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const admin = createAdminClient();
  const now = new Date();
  const reminders = await step("reminders", () => createReminders(admin, now));
  const digests = await step("digests", () => createDigests(admin, now));
  const push = await step("push", () => sendDue());
  const cleanup = await step("cleanup", () => cleanupStorage(admin, now));

  return Response.json({ reminders, digests, push, cleanup }, { headers: NO_STORE });
}
