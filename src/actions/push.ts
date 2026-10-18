"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";
import { sendPush } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEST_PUSH } from "@/lib/push/render";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const endpointSchema = z.url().startsWith("https://").max(1000);

/** "iPhone", "Android Chrome"… from the user agent; only a label, never used for decisions. */
function deviceLabel(userAgent: string) {
  if (/iPhone/.test(userAgent)) return "iPhone";
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent))) return "iPad";
  if (/Android/.test(userAgent)) return /Chrome/.test(userAgent) ? "Android Chrome" : "Android";
  if (/Macintosh/.test(userAgent)) return /Chrome/.test(userAgent) ? "Mac Chrome" : /Firefox/.test(userAgent) ? "Mac Firefox" : "Mac Safari";
  if (/Windows/.test(userAgent)) return "Windows";
  return "Tarayıcı";
}

/**
 * Stores this device's push subscription (plain RLS insert, plan §9). One row
 * per artisan per endpoint; new keys for the same endpoint replace the row.
 * A device belongs to the artisan who enabled it last: rows of other accounts
 * for this exact endpoint are removed (a shared phone whose previous user
 * never logged out). Only the device itself knows its endpoint.
 */
export async function savePushSubscription(subscription: unknown): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, error: "Bu cihaz için bildirim kaydı oluşturulamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { endpoint, keys } = parsed.data;
  const { error: cleanupError } = await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).neq("owner_user_id", userId);
  if (cleanupError) return { ok: false, error: "Bildirim kaydı oluşturulamadı. Tekrar dene." };
  const { data: existing } = await supabase.from("push_subscriptions").select("p256dh, auth").eq("endpoint", endpoint).maybeSingle();
  if (existing?.p256dh === keys.p256dh && existing.auth === keys.auth) return { ok: true, data: undefined };
  if (existing) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    device_label: deviceLabel((await headers()).get("user-agent") ?? ""),
  });
  if (error && error.code !== "23505") return { ok: false, error: "Bildirim kaydı oluşturulamadı. Tekrar dene." };
  return { ok: true, data: undefined };
}

/** Whether this device's subscription is stored for the signed-in artisan (read-only). */
export async function isPushSubscribed(endpoint: string): Promise<boolean> {
  if (!endpointSchema.safeParse(endpoint).success) return false;
  const { supabase, userId } = await actionContext();
  if (!userId) return false;
  const { data } = await supabase.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
  return Boolean(data);
}

/** "Bu cihazda kapat" and logout: removes this device's row (RLS: own rows only). */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  if (!endpointSchema.safeParse(endpoint).success) return { ok: true, data: undefined };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: "Kapatılamadı. Tekrar dene." };
  return { ok: true, data: undefined };
}

/** "Test bildirimi gönder": only to this device, and only if it is the caller's own subscription. */
export async function sendTestPush(endpoint: string): Promise<ActionResult> {
  if (!endpointSchema.safeParse(endpoint).success) return { ok: false, error: "Bu cihazda bildirimler açık değil." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data: own } = await supabase.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
  if (!own) return { ok: false, error: "Bu cihazda bildirimler açık değil. Önce etkinleştir." };

  let result;
  try {
    result = await sendPush(userId, TEST_PUSH, endpoint);
  } catch {
    return { ok: false, error: "Bildirimler henüz yapılandırılmadı." };
  }
  if (result.sent) return { ok: true, data: undefined };
  if (result.removed) return { ok: false, error: "Bu cihazın bildirim kaydı geçersiz olmuş. Bildirimleri yeniden etkinleştir." };
  return { ok: false, error: "Test bildirimi gönderilemedi. Biraz sonra tekrar dene." };
}
