"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";

const BUCKET = "job-images";
const MAX_BYTES = 2 * 1024 * 1024;
const uuid = z.uuid();

/**
 * Registers a photo the browser already uploaded to Storage (plan §6). The
 * path is rebuilt from the session (never taken from the client), and the
 * object is checked for size and JPEG magic bytes before the row is created.
 * A rejected or unregistered object is removed again.
 */
export async function registerPhoto(jobId: string, mediaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success || !uuid.safeParse(mediaId).success) return { ok: false, error: "Fotoğraf kaydedilemedi." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const path = `${userId}/${jobId}/${mediaId}.jpg`;
  const storage = supabase.storage.from(BUCKET);
  const discard = async (error: string): Promise<ActionResult> => {
    await storage.remove([path]);
    return { ok: false, error };
  };

  const { data: file, error: downloadError } = await storage.download(path);
  if (downloadError || !file) return { ok: false, error: "Yüklenen fotoğraf bulunamadı. Tekrar dene." };
  if (file.size === 0 || file.size > MAX_BYTES) return discard("Fotoğraf en fazla 2 MB olabilir.");
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return discard("Dosya bir JPEG fotoğrafı değil.");

  // RLS + the composite FK make sure the job is the caller's own.
  const { error } = await supabase.from("job_media").insert({
    id: mediaId,
    job_id: jobId,
    kind: "image",
    origin: "artisan",
    visibility: "private",
    storage_bucket: BUCKET,
    storage_path: path,
    mime_type: "image/jpeg",
    size_bytes: file.size,
  });
  if (error) {
    // A repeated call for the same photo is fine (unique id/path).
    if (error.code === "23505") return { ok: true, data: undefined };
    return discard("Fotoğraf kaydedilemedi. Tekrar dene.");
  }
  refresh();
  return { ok: true, data: undefined };
}

/** "Müşteriyle paylaş": only the artisan's own photos can change visibility. */
export async function setPhotoShared(mediaId: string, shared: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(mediaId).success) return { ok: false, error: "Fotoğraf bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase
    .from("job_media")
    .update({ visibility: shared ? "shared" : "private" })
    .eq("id", mediaId)
    .eq("kind", "image")
    .eq("origin", "artisan")
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: "Kaydedilemedi. Tekrar dene." };
  if (!data.length) return { ok: false, error: "Fotoğraf bulunamadı." };
  refresh();
  return { ok: true, data: undefined };
}

/** Soft-delete the row, then remove the object (orphans are cleaned up daily, plan §6). */
export async function deletePhoto(mediaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(mediaId).success) return { ok: false, error: "Fotoğraf bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase
    .from("job_media")
    .update({ deleted_at: new Date().toISOString(), deleted_by: "artisan" })
    .eq("id", mediaId)
    .eq("kind", "image")
    .is("deleted_at", null)
    .select("storage_path");
  if (error) return { ok: false, error: "Silinemedi. Tekrar dene." };
  if (!data.length) return { ok: false, error: "Fotoğraf bulunamadı." };
  await supabase.storage.from(BUCKET).remove([data[0].storage_path]);
  refresh();
  return { ok: true, data: undefined };
}
