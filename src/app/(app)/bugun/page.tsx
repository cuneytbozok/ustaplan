import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { countOrThrow } from "@/lib/supabase/count";
import { createClient } from "@/lib/supabase/server";
import { formatDate, istanbulDayRange } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Bugün" };

export default function TodayPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Today />
    </Suspense>
  );
}

// The real Bugün screen (appointments, requests, follow-ups) arrives in M3.
async function Today() {
  const supabase = await createClient();
  const { start, end } = istanbulDayRange();
  const count = countOrThrow(
    await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString()),
  );

  return (
    <>
      <PageHeader title="Bugün" subtitle={formatDate(new Date())} />
      {count === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Bugün randevun yok"
          description="Bugünkü randevuların saat sırasıyla burada görünür."
        />
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-4 text-base text-ink">Bugün {count} randevun var.</p>
      )}
    </>
  );
}
