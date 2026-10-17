import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { createClient } from "@/lib/supabase/server";
import { findConflicts, istanbulDateKey, istanbulDateTime, istanbulToday } from "@/lib/domain/scheduling";
import { formatDate, formatShortDate, formatTime, istanbulDayRange, istanbulWeekRange } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Takvim" };

type View = "gun" | "hafta";
type Visit = { id: string; starts_at: string; ends_at: string; job: { id: string; title: string; customer: string } };

export default function CalendarPage({ searchParams }: PageProps<"/takvim">) {
  return (
    <>
      <PageHeader title="Takvim" />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function href(view: View, date: string) {
  return `/takvim?gorunum=${view}&tarih=${date}`;
}

/** Free time of at least 30 minutes between 08:00 and 20:00 around the day's visits ("müsait"). */
function freeGaps(dayKey: string, visits: Visit[]) {
  const open = istanbulDateTime(dayKey, "08:00")!.getTime();
  const close = istanbulDateTime(dayKey, "20:00")!.getTime();
  const gaps: { start: Date; end: Date }[] = [];
  let cursor = open;
  for (const v of visits) {
    const s = Date.parse(v.starts_at);
    if (s - cursor >= 30 * 60_000 && s > open) gaps.push({ start: new Date(Math.max(cursor, open)), end: new Date(Math.min(s, close)) });
    cursor = Math.max(cursor, Date.parse(v.ends_at));
  }
  if (close - cursor >= 30 * 60_000) gaps.push({ start: new Date(cursor), end: new Date(close) });
  return gaps.filter((g) => g.end > g.start);
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/takvim">["searchParams"] }) {
  const { gorunum, tarih } = await searchParams;
  const supabase = await createClient();
  const view: View = gorunum === "hafta" ? "hafta" : "gun";
  const today = istanbulToday();
  const date = typeof tarih === "string" && istanbulDateTime(tarih, "12:00") ? tarih : today;
  const noon = istanbulDateTime(date, "12:00")!;
  const { start, end } = view === "hafta" ? istanbulWeekRange(noon) : istanbulDayRange(noon);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, jobs(id, title, customers(name))")
    .eq("status", "scheduled")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .order("starts_at")
    .limit(500);
  if (error) throw new Error(error.message);
  const visits: Visit[] = data.map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    job: { id: a.jobs?.id ?? "", title: a.jobs?.title ?? "", customer: a.jobs?.customers?.name ?? "" },
  }));
  const clashing = new Set(visits.filter((v) => findConflicts({ start: new Date(v.starts_at), end: new Date(v.ends_at) }, visits, v.id).length).map((v) => v.id));

  const step = view === "hafta" ? 7 : 1;
  const prev = istanbulDateKey(noon, -step);
  const next = istanbulDateKey(noon, step);
  const lastDay = new Date(end.getTime() - 1);
  const title = view === "hafta" ? `${formatShortDate(start)} – ${formatShortDate(lastDay)}` : formatDate(noon);
  const isCurrent = view === "hafta" ? today >= istanbulDateKey(start) && today <= istanbulDateKey(lastDay) : date === today;

  return (
    <>
      <nav aria-label="Görünüm" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1">
        {(["gun", "hafta"] as const).map((v) => (
          <Link
            key={v}
            href={href(v, date)}
            replace
            scroll={false}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-lg text-sm font-semibold",
              v === view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-ink",
            )}
          >
            {v === "gun" ? "Gün" : "Hafta"}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link href={href(view, prev)} replace scroll={false} aria-label={view === "hafta" ? "Önceki hafta" : "Önceki gün"} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink hover:bg-muted">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted-foreground">{visits.length ? `${visits.length} randevu` : "Randevu yok"}</p>
        </div>
        <Link href={href(view, next)} replace scroll={false} aria-label={view === "hafta" ? "Sonraki hafta" : "Sonraki gün"} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink hover:bg-muted">
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>
      {!isCurrent ? (
        <Link href={href(view, today)} replace scroll={false} className="-mt-2 flex h-11 items-center justify-center text-sm font-semibold text-primary">
          {view === "hafta" ? "Bu haftaya dön" : "Bugüne dön"}
        </Link>
      ) : null}

      {view === "gun" ? (
        <DayView dayKey={date} visits={visits} clashing={clashing} />
      ) : (
        <WeekView start={start} visits={visits} clashing={clashing} today={today} />
      )}
    </>
  );
}

function VisitRow({ visit, clash, compact }: { visit: Visit; clash: boolean; compact?: boolean }) {
  return (
    <Link
      href={`/isler/${visit.job.id}`}
      className={cn(
        "flex min-h-16 items-start gap-3 rounded-2xl border bg-surface px-4 py-3 hover:bg-muted",
        clash ? "border-warning/50" : "border-border",
        compact && "min-h-14 rounded-xl py-2.5",
      )}
    >
      <div className="w-12 shrink-0 text-sm font-bold text-primary">
        {formatTime(visit.starts_at)}
        <span className="block text-xs font-normal text-muted-foreground">{formatTime(visit.ends_at)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink">{visit.job.customer}</p>
        <p className="truncate text-sm text-muted-foreground">{visit.job.title}</p>
      </div>
      {clash ? (
        <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-warning/12 px-2.5 text-xs font-semibold text-warning">
          <AlertTriangle className="size-3.5" aria-hidden />
          Çakışma
        </span>
      ) : null}
    </Link>
  );
}

function DayView({ dayKey, visits, clashing }: { dayKey: string; visits: Visit[]; clashing: Set<string> }) {
  if (visits.length === 0) {
    return <EmptyState icon={CalendarDays} title="Bu gün randevu yok" description="İş detayından randevu ekleyebilirsin. Gün 08:00–20:00 arası boş." />;
  }
  const gaps = freeGaps(dayKey, visits);
  // Visits and free gaps in time order.
  const rows = [
    ...visits.map((v) => ({ at: Date.parse(v.starts_at), visit: v })),
    ...gaps.map((g) => ({ at: g.start.getTime(), gap: g })),
  ].sort((a, b) => a.at - b.at);

  return (
    <ul className="flex flex-col gap-2" aria-label="Günün randevuları">
      {rows.map((row) =>
        "visit" in row && row.visit ? (
          <li key={row.visit.id}>
            <VisitRow visit={row.visit} clash={clashing.has(row.visit.id)} />
          </li>
        ) : "gap" in row && row.gap ? (
          <li key={`gap-${row.at}`} className="rounded-xl border border-dashed border-border px-4 py-2 text-sm text-muted-foreground">
            Boş · {formatTime(row.gap.start)}–{formatTime(row.gap.end)}
          </li>
        ) : null,
      )}
    </ul>
  );
}

function WeekView({ start, visits, clashing, today }: { start: Date; visits: Visit[]; clashing: Set<string>; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => istanbulDateKey(start, i));
  if (visits.length === 0) {
    return <EmptyState icon={CalendarDays} title="Bu hafta randevu yok" description="Planladığın randevular burada gün gün listelenir." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => {
        const dayVisits = visits.filter((v) => istanbulDateKey(new Date(v.starts_at)) === day);
        const noon = istanbulDateTime(day, "12:00")!;
        return (
          <section key={day} aria-label={formatDate(noon)}>
            <Link href={href("gun", day)} className="mb-1.5 flex h-11 items-center justify-between gap-2 rounded-lg px-1 hover:bg-muted">
              <span className={cn("text-sm font-semibold", day === today ? "text-primary" : "text-ink")}>
                {formatDate(noon)}
                {day === today ? " · Bugün" : ""}
              </span>
              <span className="text-xs text-muted-foreground">{dayVisits.length ? `${dayVisits.length} randevu` : "Boş"}</span>
            </Link>
            {dayVisits.length ? (
              <ul className="flex flex-col gap-2">
                {dayVisits.map((v) => (
                  <li key={v.id}>
                    <VisitRow visit={v} clash={clashing.has(v.id)} compact />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
