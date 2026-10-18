import "server-only";
import { TZDate } from "@date-fns/tz";
import { OPEN_JOB_STATUSES } from "@/lib/domain/labels";
import { followUps } from "@/lib/domain/follow-ups";
import { istanbulDateKey } from "@/lib/domain/scheduling";
import { istanbulDayRange, TIME_ZONE } from "@/lib/domain/time";
import { createAdminClient } from "@/lib/supabase/admin";

// Time-based work for /api/internal/dispatch (plan §9, DATA_MODEL §7), run
// every 5 minutes by Supabase Cron. Everything is idempotent: notification
// dedupe keys stop duplicates, cleanup only removes what is clearly orphaned.

type Admin = ReturnType<typeof createAdminClient>;

const DIGEST_FROM_HOUR = 8;
// No digest push late in the evening if the morning runs were missed.
const DIGEST_UNTIL_HOUR = 20;
const CLEANUP_HOUR = 3;
const CLEANUP_MINUTES = 10;
const BUCKETS = ["job-images", "job-audio"] as const;

const istanbulClock = (now: Date) => {
  const local = new TZDate(now, TIME_ZONE);
  return { hour: local.getHours(), minute: local.getMinutes() };
};

/**
 * 1-hour reminders (P-6): scheduled visits starting in (55, 65] minutes, so a
 * 5-minute cycle catches each one (±5 min). Visits created less than 60 min
 * before they start get none. Push only, not in the inbox.
 */
export async function createReminders(admin: Admin, now = new Date()) {
  const from = new Date(now.getTime() + 55 * 60_000).toISOString();
  const until = new Date(now.getTime() + 65 * 60_000).toISOString();
  const { data, error } = await admin
    .from("appointments")
    .select("id, owner_user_id, job_id, starts_at, created_at, jobs(title, customers(name))")
    .eq("status", "scheduled")
    .gt("starts_at", from)
    .lte("starts_at", until);
  if (error) throw new Error("reminder lookup failed");

  const rows = data
    .filter((a) => Date.parse(a.created_at) <= Date.parse(a.starts_at) - 60 * 60_000)
    .map((a) => ({
      owner_user_id: a.owner_user_id,
      job_id: a.job_id,
      appointment_id: a.id,
      category: "appointment_reminder",
      payload: { job_title: a.jobs?.title ?? "", customer_name: a.jobs?.customers?.name ?? "", starts_at: a.starts_at },
      dedupe_key: `appt-reminder:${a.id}`,
      in_inbox: false,
      push_status: "pending",
      push_next_attempt_at: now.toISOString(),
    }));
  if (!rows.length) return 0;
  const { data: inserted, error: insertError } = await admin
    .from("notifications")
    .upsert(rows, { onConflict: "owner_user_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (insertError) throw new Error("reminder insert failed");
  return inserted?.length ?? 0;
}

/**
 * Morning digest (P-6): once per Istanbul day, from 08:00 (until 20:00), per
 * artisan with a device, only when something needs attention: today's visits,
 * date requests waiting for an answer, follow-ups (same rule as Bugün).
 */
export async function createDigests(admin: Admin, now = new Date()) {
  const { hour } = istanbulClock(now);
  if (hour < DIGEST_FROM_HOUR || hour >= DIGEST_UNTIL_HOUR) return 0;
  const dedupeKey = `digest:${istanbulDateKey(now)}`;

  // Artisans with at least one device, minus those who already have today's digest.
  const [devices, done] = await Promise.all([
    admin.from("push_subscriptions").select("owner_user_id"),
    admin.from("notifications").select("owner_user_id").eq("dedupe_key", dedupeKey),
  ]);
  if (devices.error || done.error) throw new Error("digest lookup failed");
  const already = new Set(done.data.map((d) => d.owner_user_id));
  const owners = [...new Set(devices.data.map((d) => d.owner_user_id))].filter((id) => !already.has(id));

  const { start, end } = istanbulDayRange(now);
  let created = 0;
  for (const owner of owners) {
    const [today, requests, open] = await Promise.all([
      admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", owner)
        .eq("status", "scheduled")
        .lt("starts_at", end.toISOString())
        .gt("ends_at", start.toISOString()),
      admin.from("appointment_requests").select("id", { count: "exact", head: true }).eq("owner_user_id", owner).eq("status", "pending_artisan"),
      admin
        .from("jobs")
        .select("id, appointments(starts_at, ends_at, status)")
        .eq("owner_user_id", owner)
        .in("status", [...OPEN_JOB_STATUSES])
        .eq("appointments.status", "scheduled")
        .limit(500),
    ]);
    if (today.error || requests.error || open.error) throw new Error("digest counts failed");
    const counts = { today: today.count ?? 0, requests: requests.count ?? 0, follow_ups: followUps(open.data, now).length };
    if (!counts.today && !counts.requests && !counts.follow_ups) continue;

    const { data: inserted, error } = await admin
      .from("notifications")
      .upsert(
        {
          owner_user_id: owner,
          category: "daily_digest",
          payload: counts,
          dedupe_key: dedupeKey,
          in_inbox: false,
          push_status: "pending",
          push_next_attempt_at: now.toISOString(),
        },
        { onConflict: "owner_user_id,dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error("digest insert failed");
    created += inserted?.length ?? 0;
  }
  return created;
}

/**
 * Nightly storage cleanup (plan §6), in the first 10 minutes after 03:00
 * Istanbul: removes objects whose media row was soft-deleted, and objects
 * with no row at all that are older than a day (an upload that was never
 * registered). Rows stay as the audit trail (DATA_MODEL §8).
 */
export async function cleanupStorage(admin: Admin, now = new Date()) {
  const { hour, minute } = istanbulClock(now);
  if (hour !== CLEANUP_HOUR || minute >= CLEANUP_MINUTES) return null;
  const dayAgo = now.getTime() - 24 * 3_600_000;
  let removed = 0;

  for (const bucket of BUCKETS) {
    const storage = admin.storage.from(bucket);
    const { data: owners } = await storage.list("", { limit: 1000 });
    for (const owner of owners ?? []) {
      const { data: jobs } = await storage.list(owner.name, { limit: 1000 });
      for (const job of jobs ?? []) {
        const prefix = `${owner.name}/${job.name}`;
        const { data: files } = await storage.list(prefix, { limit: 1000 });
        if (!files?.length) continue;
        const paths = files.map((f) => `${prefix}/${f.name}`);
        const { data: rows, error } = await admin.from("job_media").select("storage_path, deleted_at").in("storage_path", paths);
        if (error) throw new Error("media lookup failed");
        const byPath = new Map(rows.map((r) => [r.storage_path, r.deleted_at]));
        const orphaned = files
          .filter((f) => {
            const path = `${prefix}/${f.name}`;
            if (byPath.has(path)) return byPath.get(path) !== null; // soft-deleted row
            return Date.parse(f.created_at ?? "") < dayAgo; // never registered
          })
          .map((f) => `${prefix}/${f.name}`);
        if (!orphaned.length) continue;
        const { error: removeError } = await storage.remove(orphaned);
        if (!removeError) removed += orphaned.length;
      }
    }
  }
  return removed;
}
