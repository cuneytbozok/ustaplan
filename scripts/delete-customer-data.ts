/**
 * KVKK erasure of one customer (privacy doc §3, plan P-3): storage objects
 * first, then the jobs (cascading appointments, requests, media rows, events,
 * notifications), then the customer (cascading addresses). Dry run by
 * default; --confirm deletes. Safe to repeat if interrupted. Prints counts
 * only, never names, phones or addresses.
 *
 *   npm run admin:delete-customer -- --customer <uuid>            (dry run)
 *   npm run admin:delete-customer -- --customer <uuid> --confirm
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "./admin-shared";
import { customerFootprint } from "./customer-data-shared";

async function main() {
  const { values } = parseArgs({ options: { customer: { type: "string" }, confirm: { type: "boolean" } } });
  const id = z.uuid().safeParse(values.customer);
  if (!id.success) fail("Usage: --customer <uuid> [--confirm]");

  const admin = createAdminClient();
  const footprint = await customerFootprint(admin, id.data);
  if (!footprint) {
    console.log(`No customer ${id.data}: nothing to delete (already erased?).`);
    return;
  }
  const { customer, addresses, jobs, appointments, requests, media, events, notifications, objects } = footprint;
  console.log(`Customer ${customer.id} (artisan ${customer.owner_user_id}):`);
  console.log(`  addresses ${addresses.length}, jobs ${jobs.length}, appointments ${appointments.length}, requests ${requests.length}`);
  console.log(`  media rows ${media.length}, storage objects ${objects.length}, events ${events.length}, notifications ${notifications.length}`);

  if (!values.confirm) {
    console.log("\nDry run: nothing changed. Re-run with --confirm to delete all of the above.");
    return;
  }

  for (const bucket of new Set(objects.map((object) => object.bucket))) {
    const paths = objects.filter((object) => object.bucket === bucket).map((object) => object.path);
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) fail(`Storage removal failed in ${bucket} (nothing else deleted yet; re-run): ${error.message}`);
  }
  if (jobs.length) {
    const { error } = await admin.from("jobs").delete().in("id", jobs.map((job) => String(job.id)));
    if (error) fail(`Deleting jobs failed (storage already removed; re-run): ${error.message}`);
  }
  const { error } = await admin.from("customers").delete().eq("id", customer.id);
  if (error) fail(`Deleting the customer failed (jobs already removed; re-run): ${error.message}`);

  const left = await customerFootprint(admin, id.data);
  if (left) fail("The customer still exists after deletion; check the dashboard.");
  console.log(`\nDeleted. Record the request in the private log: date, "erasure", ${customer.id}.`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
