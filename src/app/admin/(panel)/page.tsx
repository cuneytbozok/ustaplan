import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";
import { getTotals } from "@/lib/admin/stats";

export const metadata: Metadata = { title: "Genel bakış" };

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Genel bakış" />
      <Suspense fallback={<ListSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  // Pages render in parallel with layouts, so every admin page gates itself.
  await requireAdmin();
  const totals = await getTotals();
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        { label: "Usta", value: totals.artisans },
        { label: "Müşteri", value: totals.customers },
        { label: "İş", value: totals.jobs },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-2xl border border-border bg-surface p-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-2xl font-bold text-ink">{value.toLocaleString("tr-TR")}</dd>
        </div>
      ))}
    </dl>
  );
}
