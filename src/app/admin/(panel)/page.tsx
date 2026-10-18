import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { formatMoment } from "@/components/admin/admin-bits";
import { WeeklyBars } from "@/components/admin/weekly-bars";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";
import { getOverview, type Overview } from "@/lib/admin/stats";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "Genel bakış" };

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Genel bakış" subtitle="Tüm ustaların toplam kullanımı. Müşteri bilgileri burada görünmez." />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <OverviewContent />
      </Suspense>
    </>
  );
}

const n = (value: number) => value.toLocaleString("tr-TR");

async function OverviewContent() {
  // Pages render in parallel with layouts, so every admin page gates itself.
  await requireAdmin();
  const data = await getOverview();

  return (
    <>
      <section aria-labelledby="new-jobs" className="flex flex-col gap-3">
        <h2 id="new-jobs" className="text-base font-semibold text-ink">
          Açılan işler
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Period label="Bugün" value={data.newJobs.today} previous={`Dün ${n(data.newJobs.yesterday)}`} />
          <Period label="Bu hafta" value={data.newJobs.thisWeek} previous={`Geçen hafta ${n(data.newJobs.lastWeek)}`} />
          <Period label="Bu ay" value={data.newJobs.thisMonth} previous={`Geçen ay ${n(data.newJobs.lastMonth)}`} />
        </div>
      </section>

      <section aria-label="Eğilim" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <WeeklyBars title="Açılan iş" unit="iş" points={data.trend.map((week) => ({ weekStart: week.weekStart, value: week.jobs }))} />
        <WeeklyBars title="Yeni müşteri" unit="müşteri" points={data.trend.map((week) => ({ weekStart: week.weekStart, value: week.customers }))} />
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Usage data={data} />
        <StatusBreakdown byStatus={data.jobsByStatus} total={data.totals.jobs} />
        <Health data={data} />
      </div>
    </>
  );
}

function Period({ label, value, previous }: { label: string; value: number; previous: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink tabular-nums sm:text-3xl">{n(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{previous}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="flex flex-col divide-y divide-border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-semibold text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Usage({ data }: { data: Overview }) {
  return (
    <Card title="Kullanım">
      <Rows
        rows={[
          ["Usta (aktif hesap)", `${n(data.artisans.active)} / ${n(data.artisans.total)}`],
          ["Son 7 günde kullanan", n(data.artisans.active7)],
          ["Son 30 günde kullanan", n(data.artisans.active30)],
          ["Müşteri", n(data.totals.customers)],
          ["İş", n(data.totals.jobs)],
          ["Bugünkü randevu", n(data.appointments.today)],
          ["Bu haftaki randevu", n(data.appointments.thisWeek)],
        ]}
      />
      <p className="text-xs text-muted-foreground">Kullanan: giriş yapan ya da kayıt ekleyen/değiştiren aktif usta.</p>
    </Card>
  );
}

const STATUS_ORDER: JobStatus[] = ["unplanned", "scheduled", "in_progress", "waiting_material", "completed", "cancelled"];

function StatusBreakdown({ byStatus, total }: { byStatus: Record<JobStatus, number>; total: number }) {
  return (
    <Card title="İşler durumlara göre">
      <ul className="flex flex-col gap-2.5 text-sm">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3">
              <span className="text-ink">{JOB_STATUS_LABELS[status]}</span>
              <span className="font-semibold text-ink tabular-nums">{n(byStatus[status])}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: total ? `${(byStatus[status] / total) * 100}%` : 0 }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Health({ data }: { data: Overview }) {
  const problem = data.push.failed24h > 0 || data.push.delayed;
  return (
    <Card title="Sistem">
      <p className={problem ? "flex items-center gap-2 text-sm font-medium text-warning" : "flex items-center gap-2 text-sm font-medium text-primary"}>
        {problem ? <CircleAlert className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
        {problem ? "Bildirimlerde gecikme ya da hata var" : "Bildirimler normal"}
      </p>
      <Rows
        rows={[
          ["Son 24 saatte gönderilen", n(data.push.sent24h)],
          ["Son 24 saatte başarısız", n(data.push.failed24h)],
          ["Son 24 saatte cihaz yok (atlandı)", n(data.push.skipped24h)],
          ["Sırada bekleyen", n(data.push.waiting)],
          ["En eski bekleyen", formatMoment(data.push.oldestWaitingAt)],
          ["Son gönderim", formatMoment(data.push.lastSentAt, "Henüz yok")],
          ["Fotoğraf ve ses kaydı", n(data.media.files)],
          ["Depolama", `${(data.media.bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`],
        ]}
      />
    </Card>
  );
}
