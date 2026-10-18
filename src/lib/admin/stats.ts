import "server-only";
import { TZDate } from "@date-fns/tz";
import { addMonths, startOfMonth } from "date-fns";
import { isBanned, listAllUsers } from "@/lib/admin/accounts";
import { istanbulDayRange, istanbulWeekRange, TIME_ZONE } from "@/lib/domain/time";
import { JOB_STATUS_LABELS as JOB_STATUS_ORDER, OPEN_JOB_STATUSES, type JobStatus } from "@/lib/domain/labels";
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

/** PostgREST returns at most 1000 rows per request, so page through (optionally only rows created since a time). */
async function selectAll<T>(admin: Admin, table: Table, columns: string, createdSince?: Date): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = admin.from(table).select(columns).order("id").range(from, from + PAGE - 1);
    if (createdSince) query = query.gte("created_at", createdSince.toISOString());
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

type Range = { start: Date; end: Date };

function istanbulMonthRange(now: Date): Range {
  const start = startOfMonth(new TZDate(now, TIME_ZONE));
  return { start: new Date(start.getTime()), end: new Date(addMonths(start, 1).getTime()) };
}

function countIn(timestamps: string[], range: Range) {
  return timestamps.filter((value) => {
    const at = Date.parse(value);
    return at >= range.start.getTime() && at < range.end.getTime();
  }).length;
}

export const TREND_WEEKS = 12;

export type Overview = {
  newJobs: Record<"today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth", number>;
  appointments: { today: number; thisWeek: number };
  artisans: { total: number; active: number; deactivated: number; active7: number; active30: number };
  totals: { customers: number; jobs: number };
  jobsByStatus: Record<JobStatus, number>;
  trend: { weekStart: string; jobs: number; customers: number }[];
  push: { sent24h: number; failed24h: number; skipped24h: number; waiting: number; oldestWaitingAt: string | null; lastSentAt: string | null; delayed: boolean };
  media: { files: number; bytes: number };
};

/** Everything the Genel bakış page shows, in one pass. */
export async function getOverview(now = new Date()): Promise<Overview> {
  const admin = createAdminClient();
  const day = istanbulDayRange(now);
  const yesterday = istanbulDayRange(new Date(day.start.getTime() - 1));
  const week = istanbulWeekRange(now);
  const lastWeek = istanbulWeekRange(new Date(week.start.getTime() - 1));
  const month = istanbulMonthRange(now);
  const lastMonth = istanbulMonthRange(new Date(month.start.getTime() - 1));
  const weeks = Array.from({ length: TREND_WEEKS }, (_, index) => istanbulWeekRange(new Date(week.start.getTime() - index * 7 * DAY_MS))).reverse();
  const since = new Date(Math.min(weeks[0].start.getTime(), lastMonth.start.getTime()));
  const since24h = new Date(now.getTime() - DAY_MS);

  const [artisans, recentJobs, recentCustomers, allJobs, customerCount, appointments, notifications, waiting, lastSent, media] = await Promise.all([
    getArtisanRows(now),
    selectAll<{ created_at: string }>(admin, "jobs", "id, created_at", since),
    selectAll<{ created_at: string }>(admin, "customers", "id, created_at", since),
    selectAll<{ status: JobStatus }>(admin, "jobs", "id, status"),
    count(admin, "customers"),
    admin
      .from("appointments")
      .select("starts_at")
      .eq("status", "scheduled")
      .gte("starts_at", week.start.toISOString())
      .lt("starts_at", week.end.toISOString()),
    selectAll<{ push_status: string }>(admin, "notifications", "id, push_status", since24h),
    // Still to be sent: pending, being sent, or failed with a retry scheduled (final failures stay "failed").
    admin
      .from("notifications")
      .select("created_at")
      .or("push_status.in.(pending,sending),and(push_status.eq.failed,push_next_attempt_at.not.is.null)")
      .order("created_at")
      .limit(1000),
    admin.from("notifications").select("pushed_at").not("pushed_at", "is", null).order("pushed_at", { ascending: false }).limit(1).maybeSingle(),
    selectAll<{ size_bytes: number; deleted_at: string | null }>(admin, "job_media", "id, size_bytes, deleted_at"),
  ]);
  for (const result of [appointments, waiting, lastSent]) if (result.error) throw new Error(`Could not read overview: ${result.error.message}`);

  const visits = (appointments.data ?? []).map((visit) => visit.starts_at);
  const jobTimes = recentJobs.map((job) => job.created_at);
  const customerTimes = recentCustomers.map((customer) => customer.created_at);
  const liveMedia = media.filter((row) => !row.deleted_at);
  const activeWithin = (days: number) =>
    artisans.filter((artisan) => {
      const last = latest(artisan.lastSignInAt, artisan.lastActivityAt);
      return artisan.active && last !== null && Date.parse(last) >= now.getTime() - days * DAY_MS;
    }).length;
  const jobsByStatus = Object.fromEntries(Object.keys(JOB_STATUS_ORDER).map((status) => [status, 0])) as Record<JobStatus, number>;
  for (const job of allJobs) jobsByStatus[job.status] += 1;

  return {
    newJobs: {
      today: countIn(jobTimes, day),
      yesterday: countIn(jobTimes, yesterday),
      thisWeek: countIn(jobTimes, week),
      lastWeek: countIn(jobTimes, lastWeek),
      thisMonth: countIn(jobTimes, month),
      lastMonth: countIn(jobTimes, lastMonth),
    },
    appointments: {
      today: countIn(visits, day),
      thisWeek: visits.length,
    },
    artisans: {
      total: artisans.length,
      active: artisans.filter((artisan) => artisan.active).length,
      deactivated: artisans.filter((artisan) => !artisan.active).length,
      active7: activeWithin(7),
      active30: activeWithin(30),
    },
    totals: { customers: customerCount, jobs: allJobs.length },
    jobsByStatus,
    trend: weeks.map((range) => ({
      weekStart: range.start.toISOString(),
      jobs: countIn(jobTimes, range),
      customers: countIn(customerTimes, range),
    })),
    push: {
      sent24h: notifications.filter((row) => row.push_status === "sent").length,
      failed24h: notifications.filter((row) => row.push_status === "failed").length,
      skipped24h: notifications.filter((row) => row.push_status === "skipped").length,
      waiting: waiting.data?.length ?? 0,
      oldestWaitingAt: waiting.data?.[0]?.created_at ?? null,
      lastSentAt: lastSent.data?.pushed_at ?? null,
      // Pending pushes older than 1 h are never sent (M5.8), so anything older means the dispatcher isn't running.
      delayed: Boolean(waiting.data?.[0] && Date.parse(waiting.data[0].created_at) < now.getTime() - 3600_000),
    },
    media: { files: liveMedia.length, bytes: liveMedia.reduce((sum, row) => sum + row.size_bytes, 0) },
  };
}
