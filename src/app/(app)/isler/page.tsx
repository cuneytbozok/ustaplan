import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, ClipboardList, SearchX, XCircle } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SearchBox } from "@/components/common/search-box";
import { ListSkeleton } from "@/components/common/skeleton";
import { JobStatusBadge } from "@/components/jobs/job-status-badge";
import { createClient } from "@/lib/supabase/server";
import { OPEN_JOB_STATUSES } from "@/lib/domain/labels";
import { formatShortDate } from "@/lib/domain/time";
import { readQuery, searchKeyPattern } from "@/lib/search";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "İşler" };

const FILTERS = {
  acik: { label: "Açık", statuses: [...OPEN_JOB_STATUSES], order: "updated_at" },
  tamamlanan: { label: "Tamamlanan", statuses: ["completed"], order: "completed_at" },
  iptal: { label: "İptal", statuses: ["cancelled"], order: "cancelled_at" },
} as const;
type FilterKey = keyof typeof FILTERS;

const LIMIT = 200;

export default function JobsPage({ searchParams }: PageProps<"/isler">) {
  return (
    <>
      <PageHeader title="İşler" />
      <Suspense fallback={<div className="h-12 rounded-xl border border-border bg-surface" />}>
        <SearchBox label="İş ara" placeholder="İş, müşteri veya telefon ara" />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <JobList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function filterHref(filter: FilterKey, query: string) {
  const params = new URLSearchParams();
  if (filter !== "acik") params.set("durum", filter);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/isler?${search}` : "/isler";
}

async function JobList({ searchParams }: { searchParams: PageProps<"/isler">["searchParams"] }) {
  const { durum, q } = await searchParams;
  const filterKey: FilterKey = typeof durum === "string" && durum in FILTERS ? (durum as FilterKey) : "acik";
  const filter = FILTERS[filterKey];
  const query = readQuery(q);

  const supabase = await createClient();
  const select = "id, title, status, created_at, updated_at, completed_at, cancelled_at, customers(name)";
  const base = () =>
    supabase
      .from("jobs")
      .select(select)
      .in("status", [...filter.statuses])
      .order(filter.order, { ascending: false })
      .limit(LIMIT);

  let jobs;
  if (!query) {
    const { data, error } = await base();
    if (error) throw new Error(error.message);
    jobs = data;
  } else {
    // Title matches, plus jobs of customers whose name or phone matches.
    const pattern = searchKeyPattern(query);
    const customers = await supabase.from("customers").select("id").ilike("search_key", pattern).limit(LIMIT);
    if (customers.error) throw new Error(customers.error.message);
    const customerIds = customers.data.map((c) => c.id);
    const [byTitle, byCustomer] = await Promise.all([
      base().ilike("search_key", pattern),
      customerIds.length ? base().in("customer_id", customerIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (byTitle.error) throw new Error(byTitle.error.message);
    if (byCustomer.error) throw new Error(byCustomer.error.message);
    const merged = new Map([...byTitle.data, ...byCustomer.data].map((job) => [job.id, job]));
    jobs = [...merged.values()].sort((a, b) => String(b[filter.order] ?? "").localeCompare(String(a[filter.order] ?? "")));
  }

  return (
    <>
      <nav aria-label="İş durumu" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
          <Link
            key={key}
            href={filterHref(key, query)}
            replace
            scroll={false}
            aria-current={key === filterKey ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center rounded-lg text-sm font-semibold",
              key === filterKey ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-ink",
            )}
          >
            {FILTERS[key].label}
          </Link>
        ))}
      </nav>

      {jobs.length === 0 ? (
        query ? (
          <EmptyState icon={SearchX} title="Sonuç yok" description={`“${query}” ile eşleşen ${filter.label.toLowerCase()} iş bulunamadı.`} />
        ) : filterKey === "acik" ? (
          <EmptyState icon={ClipboardList} title="Açık işin yok" description="Yeni bir iş kaydettiğinde burada durumuyla birlikte görünür." />
        ) : filterKey === "tamamlanan" ? (
          <EmptyState icon={CheckCircle2} title="Tamamlanan iş yok" description="Bitirdiğin işler burada listelenir." />
        ) : (
          <EmptyState icon={XCircle} title="İptal edilen iş yok" description="İptal edilen işler burada listelenir; istersen yeniden açabilirsin." />
        )
      ) : (
        <ul className="flex flex-col gap-2" aria-label={`${filter.label} işler`}>
          {/* Rows open the job detail page once it exists (M2.4). */}
          {jobs.map((job) => {
            const date = job[filter.order] ?? job.created_at;
            return (
              <li key={job.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-ink">{job.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {job.customers?.name} · {formatShortDate(date)}
                  </p>
                </div>
                <JobStatusBadge status={job.status} />
              </li>
            );
          })}
        </ul>
      )}
      {jobs.length === LIMIT ? <p className="text-center text-xs text-muted-foreground">İlk {LIMIT} iş gösteriliyor. Aramayı daraltabilirsin.</p> : null}
    </>
  );
}
