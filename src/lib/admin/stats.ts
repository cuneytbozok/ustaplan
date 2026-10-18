import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

async function count(table: "profiles" | "customers" | "jobs") {
  const { count: value, error } = await createAdminClient().from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return value ?? 0;
}

/** Totals across all artisans (counts only, plan A-4). Callers must have passed requireAdmin(). */
export async function getTotals() {
  const [artisans, customers, jobs] = await Promise.all([count("profiles"), count("customers"), count("jobs")]);
  return { artisans, customers, jobs };
}
