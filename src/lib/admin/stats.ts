import "server-only";
import { isBanned, listAllUsers } from "@/lib/admin/accounts";
import { OPEN_JOB_STATUSES, type JobStatus } from "@/lib/domain/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Admin figures (plan §4.1, A-4): counts per artisan only, never customer
 * personal data or job content. Computed in TypeScript over admin-client
 * reads, which is fine at pilot scale. Callers must have passed requireAdmin().
 */
type Admin = ReturnType<typeof createAdminClient>;
type Table = keyof Database["public"]["Tables"];

const PAGE = 1000;
const DAY_MS = 24 * 3600 * 1000;

/** PostgREST returns at most 1000 rows per request, so page through. */
async function selectAll<T>(admin: Admin, table: Table, columns: string, filter?: (query: never) => unknown): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = admin.from(table).select(columns).order("id").range(from, from + PAGE - 1);
    if (filter) query = filter(query as never) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

async function count(admin: Admin, table: "profiles" | "customers" | "jobs") {
  const { count: value, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return value ?? 0;
}

/** Totals across all artisans. */
export async function getTotals() {
  const admin = createAdminClient();
  const [artisans, customers, jobs] = await Promise.all([count(admin, "profiles"), count(admin, "customers"), count(admin, "jobs")]);
  return { artisans, customers, jobs };
}

export type ArtisanRow = {
  id: string;
  displayName: string;
  businessName: string | null;
  email: string;
  active: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  lastActivityAt: string | null;
  customers: number;
  jobs: Record<"open" | "completed" | "cancelled" | "total" | "last30Days", number>;
  pushDevices: number;
};

const OPEN = new Set<string>(OPEN_JOB_STATUSES);

function latest(...values: (string | null | undefined)[]) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

/** Every artisan (users with a profile) with their counts; the admin account has no profile and never appears. */
export async function getArtisanRows(now = new Date()): Promise<ArtisanRow[]> {
  const admin = createAdminClient();
  const [users, profiles, customers, jobs, devices] = await Promise.all([
    listAllUsers(admin),
    selectAll<{ id: string; display_name: string; business_name: string | null; created_at: string }>(admin, "profiles", "id, display_name, business_name, created_at"),
    selectAll<{ owner_user_id: string; created_at: string }>(admin, "customers", "id, owner_user_id, created_at"),
    selectAll<{ owner_user_id: string; status: JobStatus; created_at: string }>(admin, "jobs", "id, owner_user_id, status, created_at"),
    selectAll<{ owner_user_id: string }>(admin, "push_subscriptions", "id, owner_user_id"),
  ]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const since30 = now.getTime() - 30 * DAY_MS;

  // Last recorded change per artisan (one small query each; few artisans in the pilot).
  const lastEvents = await Promise.all(
    profiles.map(async (profile) => {
      const { data } = await admin
        .from("job_events")
        .select("created_at")
        .eq("owner_user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at ?? null;
    }),
  );

  return profiles
    .map((profile, index) => {
      const user = usersById.get(profile.id);
      const own = jobs.filter((job) => job.owner_user_id === profile.id);
      const ownCustomers = customers.filter((customer) => customer.owner_user_id === profile.id);
      return {
        id: profile.id,
        displayName: profile.display_name,
        businessName: profile.business_name,
        email: user?.email ?? "",
        active: user ? !isBanned(user, now) : false,
        createdAt: profile.created_at,
        lastSignInAt: user?.last_sign_in_at ?? null,
        lastActivityAt: latest(lastEvents[index], ...ownCustomers.map((customer) => customer.created_at)),
        customers: ownCustomers.length,
        jobs: {
          open: own.filter((job) => OPEN.has(job.status)).length,
          completed: own.filter((job) => job.status === "completed").length,
          cancelled: own.filter((job) => job.status === "cancelled").length,
          total: own.length,
          last30Days: own.filter((job) => Date.parse(job.created_at) >= since30).length,
        },
        pushDevices: devices.filter((device) => device.owner_user_id === profile.id).length,
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName, "tr"));
}
