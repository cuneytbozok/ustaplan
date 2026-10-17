import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type VoiceNoteItem = { id: string; url: string; durationSeconds: number; createdAt: string };

/** A job's live voice notes with 1 h signed URLs (artisan-only; RLS scopes the rows). */
export async function loadVoiceNotes(supabase: Client, jobId: string): Promise<VoiceNoteItem[]> {
  const { data, error } = await supabase
    .from("job_media")
    .select("id, storage_path, duration_seconds, created_at")
    .eq("job_id", jobId)
    .eq("kind", "audio")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const signed = await supabase.storage.from("job-audio").createSignedUrls(data.map((m) => m.storage_path), 3600);
  if (signed.error) throw new Error(signed.error.message);
  const urls = new Map(signed.data.map((s) => [s.path, s.signedUrl]));
  return data.flatMap((m) => {
    const url = urls.get(m.storage_path);
    return url ? [{ id: m.id, url, durationSeconds: m.duration_seconds ?? 0, createdAt: m.created_at }] : [];
  });
}
