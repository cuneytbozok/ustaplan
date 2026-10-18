/**
 * Downloads every object of the private buckets into <dir>/<bucket>/<path>
 * (part of scripts/backup.sh). Paths are <owner>/<job>/<file>. Prints counts only.
 *
 *   npx tsx --env-file-if-exists=.env.local --conditions=react-server scripts/backup-storage.ts <dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "./admin-shared";
import { BUCKETS, outsideRepository } from "./customer-data-shared";

async function main() {
  const dir = process.argv[2];
  if (!dir) fail("Usage: backup-storage.ts <dir outside the repository>");
  const root = outsideRepository(dir);
  const admin = createAdminClient();
  let count = 0;
  let bytes = 0;

  for (const bucket of BUCKETS) {
    const storage = admin.storage.from(bucket);
    const list = async (prefix: string) => {
      const { data, error } = await storage.list(prefix, { limit: 1000 });
      if (error) fail(`Could not list ${bucket}/${prefix}: ${error.message}`);
      return data ?? [];
    };
    for (const owner of await list("")) {
      for (const job of await list(owner.name)) {
        for (const file of await list(`${owner.name}/${job.name}`)) {
          const path = `${owner.name}/${job.name}/${file.name}`;
          const { data: blob, error } = await storage.download(path);
          if (error || !blob) fail(`Could not download ${bucket}/${path}: ${error?.message}`);
          const target = join(root, bucket, path);
          mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
          const buffer = Buffer.from(await blob.arrayBuffer());
          writeFileSync(target, buffer, { mode: 0o600 });
          count += 1;
          bytes += buffer.length;
        }
      }
    }
  }
  console.log(`Storage: ${count} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
