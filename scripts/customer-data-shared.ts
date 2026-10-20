import { resolve, sep } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "./admin-shared";

/** One customer's footprint (privacy doc §3): rows by id and every storage object in their jobs' folders. */
type Admin = ReturnType<typeof createAdminClient>;
export const BUCKETS = ["job-images", "job-audio"] as const;

export async function customerFootprint(admin: Admin, customerId: string) {
  const { data: customer, error } = await admin.from("customers").select("*").eq("id", customerId).maybeSingle();
  if (error) fail(`Could not read the customer: ${error.message}`);
  if (!customer) return null;

  const rows = async (table: "customer_addresses" | "jobs", column: string, value: string) => {
    const result = await admin.from(table).select("*").eq(column, value);
    if (result.error) fail(`Could not read ${table}: ${result.error.message}`);
    return result.data as Record<string, unknown>[];
  };
  const byJobs = async (table: "appointments" | "appointment_requests" | "job_media" | "job_notes" | "job_events" | "notifications", jobIds: string[]) => {
    if (!jobIds.length) return [];
    const result = await admin.from(table).select("*").in("job_id", jobIds);
    if (result.error) fail(`Could not read ${table}: ${result.error.message}`);
    return result.data as Record<string, unknown>[];
  };

  const addresses = await rows("customer_addresses", "customer_id", customerId);
  const jobs = await rows("jobs", "customer_id", customerId);
  const jobIds = jobs.map((job) => String(job.id));
  const [appointments, requests, media, notes, events, notifications] = await Promise.all(
    (["appointments", "appointment_requests", "job_media", "job_notes", "job_events", "notifications"] as const).map((table) => byJobs(table, jobIds)),
  );

  // Every object under <owner>/<job>/, registered in job_media or not.
  const objects: { bucket: (typeof BUCKETS)[number]; path: string }[] = [];
  for (const bucket of BUCKETS) {
    for (const jobId of jobIds) {
      const prefix = `${customer.owner_user_id}/${jobId}`;
      const { data: files, error: listError } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (listError) fail(`Could not list ${bucket}: ${listError.message}`);
      for (const file of files ?? []) objects.push({ bucket, path: `${prefix}/${file.name}` });
    }
  }
  return { customer, addresses, jobs, appointments, requests, media, notes, events, notifications, objects };
}

/** Exports and backups hold real personal data: never inside the (public) repository. */
export function outsideRepository(dir: string) {
  const target = resolve(dir);
  const repo = resolve(__dirname, "..");
  if (target === repo || target.startsWith(repo + sep)) fail("Write exports outside the repository (it is public).");
  return target;
}
