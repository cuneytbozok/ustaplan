import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, SearchX, Users } from "lucide-react";
import { ArtisanStatus, formatMoment } from "@/components/admin/admin-bits";
import { EmptyState } from "@/components/common/empty-state";
import { SearchBox } from "@/components/common/search-box";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";
import { getArtisanRows } from "@/lib/admin/stats";
import { foldTr } from "@/lib/domain/search-fold";
import { readQuery } from "@/lib/search";

export const metadata: Metadata = { title: "Ustalar" };

export default function ArtisansPage({ searchParams }: PageProps<"/admin/ustalar">) {
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
      <Suspense fallback={<div className="h-12 rounded-xl border border-border bg-surface" />}>
        <SearchBox label="Usta ara" placeholder="Ad, işletme adı veya e-postayla ara" />
      </Suspense>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ArtisanList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ArtisanList({ searchParams }: { searchParams: PageProps<"/admin/ustalar">["searchParams"] }) {
  await requireAdmin();
  const query = readQuery((await searchParams).q);
  const all = await getArtisanRows();
  if (!all.length) {
    return <EmptyState icon={Users} title="Henüz usta yok" description="Usta ekleyince hesabı ve kullanım bilgileri burada listelenir." />;
  }

  // Few artisans: filter in memory, Turkish-folded (İ/ı, ş, ğ… match their plain letters).
  const term = foldTr(query);
  const rows = term ? all.filter((row) => foldTr(`${row.displayName} ${row.businessName ?? ""} ${row.email}`).includes(term)) : all;
  if (!rows.length) {
    return <EmptyState icon={SearchX} title="Sonuç yok" description={`“${query}” ile eşleşen usta bulunamadı.`} />;
  }

  return (
    <>
      {term ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          {rows.length} / {all.length} usta
        </p>
      ) : null}
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
    </>
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
