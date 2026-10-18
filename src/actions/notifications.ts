"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";

/** Mark one inbox item read (plain RLS update; only `read_at` is granted). Repeats are fine. */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Bildirim bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  if (error) return { ok: false, error: "Kaydedilemedi. Tekrar dene." };
  refresh();
  return { ok: true, data: undefined };
}

/** "Tümünü okundu işaretle": every unread inbox item of the artisan (RLS scopes it). */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("in_inbox", true)
    .is("read_at", null);
  if (error) return { ok: false, error: "Kaydedilemedi. Tekrar dene." };
  refresh();
  return { ok: true, data: undefined };
}
