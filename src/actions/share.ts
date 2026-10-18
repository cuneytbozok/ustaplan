"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";

const uuid = z.uuid();

/** "Bağlantıyı kapat / aç": a plain owner update; jobs_log_changes records it. Effective immediately. */
export async function setShareEnabled(jobId: string, enabled: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success) return { ok: false, error: "İş bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };
  const { data, error } = await supabase.from("jobs").update({ share_enabled: enabled }).eq("id", jobId).select("id");
  if (error) return { ok: false, error: "Kaydedilemedi. Tekrar dene." };
  if (!data.length) return { ok: false, error: "İş bulunamadı." };
  refresh();
  return { ok: true, data: undefined };
}

/**
 * "Yeni bağlantı oluştur": share_version + 1 kills every earlier link (plan §5).
 * The update only applies to the version the artisan saw, so two taps can't skip ahead twice.
 */
export async function regenerateShareLink(jobId: string, currentVersion: number): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success || !Number.isInteger(currentVersion) || currentVersion < 1) return { ok: false, error: "İş bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };
  const { error } = await supabase
    .from("jobs")
    .update({ share_version: currentVersion + 1, share_enabled: true })
    .eq("id", jobId)
    .eq("share_version", currentVersion);
  if (error) return { ok: false, error: "Yeni bağlantı oluşturulamadı. Tekrar dene." };
  // No row: someone already regenerated it; the refreshed page shows the current link.
  refresh();
  return { ok: true, data: undefined };
}
