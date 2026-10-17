import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarCheck, CalendarPlus, CalendarClock, MessageCircle, Navigation, Phone } from "lucide-react";
import { CompleteVisitButton } from "@/components/appointments/appointments-section";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { CompleteJobQuick } from "@/components/today/complete-job-quick";
import { createClient } from "@/lib/supabase/server";
import { OPEN_JOB_STATUSES } from "@/lib/domain/labels";
import { mapHref, whatsappHref } from "@/lib/domain/links";
import { telHref } from "@/lib/domain/phone";
import { formatDate, formatShortDate, formatTime, hasNotEnded, istanbulDayRange } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Bugün" };

export default function TodayPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Today />
    </Suspense>
  );
}

const cardClass = "rounded-2xl border border-border bg-surface p-4";
const actionClass =
  "flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted";

async function Today() {
  const supabase = await createClient();
  const { start, end } = istanbulDayRange();

  const [todayResult, openResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, jobs(id, title, status, customers(name, phone), customer_addresses(address_text))")
      .eq("status", "scheduled")
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .order("starts_at")
      .limit(100),
    // Open jobs with their scheduled visits, for "Takip gerekenler" (plan §7).
    supabase
      .from("jobs")
      .select("id, title, status, updated_at, customers(name), appointments(id, starts_at, ends_at, status)")
      .in("status", [...OPEN_JOB_STATUSES])
      .eq("appointments.status", "scheduled")
      .order("updated_at", { ascending: false })
      .limit(300),
  ]);
  if (todayResult.error) throw new Error(todayResult.error.message);
  if (openResult.error) throw new Error(openResult.error.message);

  const today = todayResult.data;
  // Follow-ups: open jobs without an upcoming visit, plus jobs with an overdue visit.
  const followUps = openResult.data
    .map((job) => {
      const overdue = job.appointments.filter((a) => !hasNotEnded(a.ends_at)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const upcoming = job.appointments.some((a) => hasNotEnded(a.ends_at));
      return { job, overdue: overdue[0], upcoming };
    })
    .filter((f) => f.overdue || !f.upcoming)
    // Overdue visits first (oldest first), then jobs without a plan.
    .sort((a, b) => (a.overdue && b.overdue ? a.overdue.starts_at.localeCompare(b.overdue.starts_at) : a.overdue ? -1 : b.overdue ? 1 : 0));

  const summary = [
    today.length ? `Bugün ${today.length} randevu` : "Bugün randevu yok",
    followUps.length ? `${followUps.length} iş takip bekliyor` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader title="Bugün" subtitle={`${formatDate(start)} · ${summary}`} />

      <section aria-labelledby="today-heading" className="flex flex-col gap-2">
        <h2 id="today-heading" className="text-base font-semibold text-ink">
          Randevular
        </h2>
        {today.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Bugün randevun yok" description="Bugünkü randevuların saat sırasıyla burada görünür." />
        ) : (
          <ul className="flex flex-col gap-2">
            {today.map((a) => {
              const job = a.jobs;
              const phone = job?.customers?.phone;
              const address = job?.customer_addresses?.address_text;
              return (
                <li key={a.id} className={cardClass}>
                  <Link href={`/isler/${job?.id}`} className="-m-1 flex items-start gap-3 rounded-xl p-1 hover:bg-muted">
                    <div className="w-12 shrink-0 text-sm font-bold text-primary">
                      {formatTime(a.starts_at)}
                      <span className="block text-xs font-normal text-muted-foreground">{formatTime(a.ends_at)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-ink">{job?.customers?.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{job?.title}</p>
                    </div>
                    {job ? <JobStatusBadge status={job.status} /> : null}
                  </Link>
                  {phone || address ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {phone ? (
                        <a href={telHref(phone)} className={actionClass}>
                          <Phone className="size-4" aria-hidden />
                          Ara
                        </a>
                      ) : null}
                      {phone ? (
                        <a href={whatsappHref(phone)} target="_blank" rel="noreferrer" className={actionClass}>
                          <MessageCircle className="size-4" aria-hidden />
                          WhatsApp
                        </a>
                      ) : null}
                      {address ? (
                        <a href={mapHref(address)} target="_blank" rel="noreferrer" className={actionClass}>
                          <Navigation className="size-4" aria-hidden />
                          Yol tarifi
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="followup-heading" className="flex flex-col gap-2">
        <h2 id="followup-heading" className="text-base font-semibold text-ink">
          Takip gerekenler
        </h2>
        {followUps.length === 0 ? (
          <p className={`${cardClass} text-sm text-muted-foreground`}>Her açık işin ileri tarihli bir randevusu var. Takip gereken iş yok.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {followUps.map(({ job, overdue }) => (
              <li key={job.id} className={cardClass}>
                <Link href={`/isler/${job.id}`} className="-m-1 flex items-start gap-3 rounded-xl p-1 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-ink">{job.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{job.customers?.name}</p>
                    <p className={overdue ? "mt-1 text-sm font-medium text-warning" : "mt-1 text-sm text-muted-foreground"}>
                      {overdue ? `Gecikmiş ziyaret · ${formatShortDate(overdue.starts_at)} ${formatTime(overdue.starts_at)}` : "Planlı randevu yok"}
                    </p>
                  </div>
                  <JobStatusBadge status={job.status} />
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {overdue ? (
                    <>
                      <CompleteVisitButton id={overdue.id} />
                      <Link href={`/isler/${job.id}?planla=${overdue.id}#randevular`} className={actionClass}>
                        <CalendarClock className="size-4" aria-hidden />
                        Yeniden planla
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link href={`/isler/${job.id}?planla=yeni#randevular`} className={actionClass}>
                        <CalendarPlus className="size-4" aria-hidden />
                        Randevu planla
                      </Link>
                      <CompleteJobQuick jobId={job.id} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
