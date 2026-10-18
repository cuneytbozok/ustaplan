import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { ArtisanStatus, formatMoment } from "@/components/admin/admin-bits";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";
import { getArtisanRows } from "@/lib/admin/stats";

export const metadata: Metadata = { title: "Ustalar" };

export default function ArtisansPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Ustalar" subtitle="Hesaplar ve kullanım. Müşteri bilgileri burada görünmez." />
        <Link
          href="/admin/ustalar/yeni"
          className="flex h-12 items-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-5" aria-hidden />
          Usta ekle
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ArtisanList />
      </Suspense>
    </>
  );
}

async function ArtisanList() {
  await requireAdmin();
  const rows = await getArtisanRows();
  if (!rows.length) {
    return <EmptyState icon={Users} title="Henüz usta yok" description="Usta ekleyince hesabı ve kullanım bilgileri burada listelenir." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/admin/ustalar/${row.id}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 hover:border-primary/40 md:flex-row md:items-center md:gap-6"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-base font-semibold text-ink">{row.displayName}</span>
                <ArtisanStatus active={row.active} />
              </div>
              <p className="truncate text-sm text-muted-foreground">{row.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Son giriş: {formatMoment(row.lastSignInAt, "hiç")} · Son işlem: {formatMoment(row.lastActivityAt, "yok")}
              </p>
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center md:w-[26rem]">
              <Metric label="Müşteri" value={row.customers} />
              <Metric label="Açık iş" value={row.jobs.open} />
              <Metric label="30 günde iş" value={row.jobs.last30Days} />
              <Metric label="Bildirim cihazı" value={row.pushDevices} />
            </dl>
            <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground md:block" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-1 py-2">
      <dd className="text-lg font-bold text-ink">{value.toLocaleString("tr-TR")}</dd>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
    </div>
  );
}
