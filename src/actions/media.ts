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

/** Soft-delete the row, then remove the object (orphans are cleaned up daily, plan §6). Photos and voice notes. */
export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  if (!uuid.safeParse(mediaId).success) return { ok: false, error: "Kayıt bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase
    .from("job_media")
    .update({ deleted_at: new Date().toISOString(), deleted_by: "artisan" })
    .eq("id", mediaId)
    .is("deleted_at", null)
    .select("storage_bucket, storage_path");
  if (error) return { ok: false, error: "Silinemedi. Tekrar dene." };
  if (!data.length) return { ok: false, error: "Kayıt bulunamadı." };
  await supabase.storage.from(data[0].storage_bucket).remove([data[0].storage_path]);
  refresh();
  return { ok: true, data: undefined };
}

// --- Voice notes (artisan-only, always private) ------------------------------

const AUDIO_BUCKET = "job-audio";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const AUDIO_TYPES = { m4a: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg" } as const;
type AudioExt = keyof typeof AUDIO_TYPES;

/** Container signatures: MP4 has "ftyp" at byte 4, WebM starts with the EBML id, Ogg with "OggS". */
function audioMagicOk(ext: AudioExt, head: Uint8Array) {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
  if (ext === "m4a") return ascii(4, 8) === "ftyp";
  if (ext === "webm") return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  return ascii(0, 4) === "OggS";
}

/** Registers a recorded voice note the browser already uploaded (same checks as photos). */
export async function registerVoiceNote(jobId: string, mediaId: string, ext: string, durationSeconds: number): Promise<ActionResult> {
  if (!uuid.safeParse(jobId).success || !uuid.safeParse(mediaId).success || !(ext in AUDIO_TYPES)) {
    return { ok: false, error: "Ses notu kaydedilemedi." };
  }
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const audioExt = ext as AudioExt;
  const path = `${userId}/${jobId}/${mediaId}.${audioExt}`;
  const storage = supabase.storage.from(AUDIO_BUCKET);
  const discard = async (error: string): Promise<ActionResult> => {
    await storage.remove([path]);
    return { ok: false, error };
  };

  const { data: file, error: downloadError } = await storage.download(path);
  if (downloadError || !file) return { ok: false, error: "Yüklenen ses notu bulunamadı. Tekrar dene." };
  if (file.size === 0 || file.size > MAX_AUDIO_BYTES) return discard("Ses notu en fazla 4 MB olabilir.");
  if (!audioMagicOk(audioExt, new Uint8Array(await file.slice(0, 12).arrayBuffer()))) return discard("Dosya bir ses kaydı değil.");

  const { error } = await supabase.from("job_media").insert({
    id: mediaId,
    job_id: jobId,
    kind: "audio",
    origin: "artisan",
    visibility: "private",
    storage_bucket: AUDIO_BUCKET,
    storage_path: path,
    mime_type: AUDIO_TYPES[audioExt],
    size_bytes: file.size,
    // Measured by the recorder; the 60 s cap is enforced there and by the table check.
    duration_seconds: Math.min(60, Math.max(1, Math.round(Number.isFinite(durationSeconds) ? durationSeconds : 1))),
  });
  if (error) {
    if (error.code === "23505") return { ok: true, data: undefined };
    return discard("Ses notu kaydedilemedi. Tekrar dene.");
  }
  refresh();
  return { ok: true, data: undefined };
}
