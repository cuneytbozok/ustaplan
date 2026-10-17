import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { countOrThrow } from "@/lib/supabase/count";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, istanbulWeekRange } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Takvim" };

export default function CalendarPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Week />
    </Suspense>
  );
}

// Day and week views arrive in M3.
async function Week() {
  const supabase = await createClient();
  const { start, end } = istanbulWeekRange();
  const count = countOrThrow(
    await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString()),
  );
  const lastDay = new Date(end.getTime() - 1);

  return (
    <>
      <PageHeader title="Takvim" subtitle={`Bu hafta · ${formatShortDate(start)} – ${formatShortDate(lastDay)}`} />
      {count === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Bu hafta randevu yok"
          description="Planladığın randevular gün ve hafta görünümünde burada yer alır."
        />
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-4 text-base text-ink">Bu hafta {count} randevun var.</p>
      )}
    </>
  );
}
