import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PhotoItem = {
  id: string;
  jobId: string;
  url: string;
  origin: "artisan" | "customer";
  shared: boolean;
  createdAt: string;
};

/** The artisan's live photos of the given jobs with 1 h signed URLs (plan §6). RLS scopes the rows. */
export async function loadPhotos(supabase: Client, jobIds: string[]): Promise<PhotoItem[]> {
  if (jobIds.length === 0) return [];
  const { data, error } = await supabase
    .from("job_media")
    .select("id, job_id, origin, visibility, storage_path, created_at")
    .in("job_id", jobIds)
    .eq("kind", "image")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  if (data.length === 0) return [];

  const signed = await supabase.storage.from("job-images").createSignedUrls(data.map((m) => m.storage_path), 3600);
  if (signed.error) throw new Error(signed.error.message);
  const urls = new Map(signed.data.map((s) => [s.path, s.signedUrl]));
  return data.flatMap((m) => {
    const url = urls.get(m.storage_path);
    return url
      ? [{ id: m.id, jobId: m.job_id, url, origin: m.origin as PhotoItem["origin"], shared: m.visibility === "shared", createdAt: m.created_at }]
      : [];
  });
}
