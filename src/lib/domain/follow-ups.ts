// "Takip gerekenler" (plan §7): open jobs with an overdue visit, plus open jobs
// without a visit that hasn't ended. Shared by Bugün and the morning digest.

import { hasNotEnded } from "./time";

type Visit = { starts_at: string; ends_at: string };

/** Scheduled visits per job in, jobs needing follow-up out: overdue ones first (oldest first), then unplanned. */
export function followUps<J extends { appointments: Visit[] }>(jobs: J[], now: Date = new Date()) {
  type V = J["appointments"][number];
  return jobs
    .map((job) => {
      const overdue = (job.appointments as V[]).filter((a) => !hasNotEnded(a.ends_at, now)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const upcoming = job.appointments.some((a) => hasNotEnded(a.ends_at, now));
      return { job, overdue: overdue[0] as V | undefined, upcoming };
    })
    .filter((f) => f.overdue || !f.upcoming)
    .sort((a, b) => (a.overdue && b.overdue ? a.overdue.starts_at.localeCompare(b.overdue.starts_at) : a.overdue ? -1 : b.overdue ? 1 : 0));
}
