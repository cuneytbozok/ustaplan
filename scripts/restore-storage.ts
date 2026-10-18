/**
 * Uploads a backup's storage folder (<dir>/<bucket>/<owner>/<job>/<file>) into
 * the project in .env.local. Existing objects are left alone (no overwrite),
 * so it is safe to repeat. Used after a database restore (RUNBOOK).
 *
 *   npx tsx --env-file-if-exists=.env.local --conditions=react-server scripts/restore-storage.ts <backup>/storage
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "./admin-shared";
import { BUCKETS } from "./customer-data-shared";

/** Same mapping as actions/media.ts (storage paths end in m4a, webm or ogg). */
const AUDIO_TYPES: Record<string, string> = { m4a: "audio/mp4", webm: "audio/webm", ogg: "audio/ogg" };

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

async function main() {
  const dir = process.argv[2];
  if (!dir) fail("Usage: restore-storage.ts <backup>/storage");
  const admin = createAdminClient();
  let uploaded = 0;
  let existing = 0;
  for (const bucket of BUCKETS) {
    let files: string[];
    try {
      files = filesUnder(join(dir, bucket));
    } catch {
      continue;
    }
    for (const file of files) {
      const path = relative(join(dir, bucket), file).split(sep).join("/");
      const extension = path.split(".").pop() ?? "";
      const contentType = bucket === "job-images" ? "image/jpeg" : (AUDIO_TYPES[extension] ?? "audio/mp4");
      const { error } = await admin.storage.from(bucket).upload(path, readFileSync(file), { contentType, upsert: false });
      if (!error) uploaded += 1;
      else if (/exists|duplicate/i.test(error.message)) existing += 1;
      else fail(`Upload failed for ${bucket}/${path}: ${error.message}`);
    }
  }
  console.log(`Storage restore: ${uploaded} uploaded, ${existing} already present.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
