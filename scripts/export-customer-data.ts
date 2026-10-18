/**
 * KVKK access request (privacy doc §3): writes one customer's data as
 * data.json plus their media files into <out>/customer-<uuid>/, for the
 * artisan to hand over. The folder must be outside the repository. Prints
 * counts only.
 *
 *   npm run admin:export-customer -- --customer <uuid> --out ~/UstaPlan-exports
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "./admin-shared";
import { customerFootprint, outsideRepository } from "./customer-data-shared";

async function main() {
  const { values } = parseArgs({ options: { customer: { type: "string" }, out: { type: "string" } } });
  const id = z.uuid().safeParse(values.customer);
  if (!id.success || !values.out) fail("Usage: --customer <uuid> --out <folder outside the repository>");
  const root = join(outsideRepository(values.out), `customer-${id.data}`);

  const admin = createAdminClient();
  const footprint = await customerFootprint(admin, id.data);
  if (!footprint) fail(`No customer ${id.data}.`);
  const { objects, notifications, ...data } = footprint;

  mkdirSync(root, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(root, "data.json"),
    JSON.stringify({ exportedAt: new Date().toISOString(), ...data, files: objects.map((object) => `${object.bucket}/${object.path}`) }, null, 2),
    { mode: 0o600 },
  );
  for (const object of objects) {
    const { data: blob, error } = await admin.storage.from(object.bucket).download(object.path);
    if (error || !blob) fail(`Could not download a file: ${error?.message}`);
    const file = join(root, "files", object.bucket, object.path);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, Buffer.from(await blob.arrayBuffer()), { mode: 0o600 });
  }
  console.log(`Exported customer ${id.data}: ${data.jobs.length} job(s), ${objects.length} file(s) → ${root}`);
  console.log(`Inbox notifications (${notifications.length}) are the artisan's own and are not included.`);
  console.log("Hand it over privately, then delete the folder.");
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
