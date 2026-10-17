import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { countOrThrow } from "@/lib/supabase/count";
import { createClient } from "@/lib/supabase/server";
import { OPEN_JOB_STATUSES } from "@/lib/domain/labels";

export const metadata: Metadata = { title: "İşler" };

export default function JobsPage() {
  return (
    <>
      <PageHeader title="İşler" />
      <Suspense fallback={<ListSkeleton />}>
        <OpenJobs />
      </Suspense>
    </>
  );
}

// The list with Açık / Tamamlanan / İptal and search arrives in M2.3.
async function OpenJobs() {
  const supabase = await createClient();
  const count = countOrThrow(
    await supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", [...OPEN_JOB_STATUSES]),
  );

  return count === 0 ? (
    <EmptyState
      icon={ClipboardList}
      title="Açık işin yok"
      description="Kaydettiğin işler durumlarıyla birlikte burada listelenir."
    />
  ) : (
    <p className="rounded-2xl border border-border bg-surface p-4 text-base text-ink">{count} açık işin var.</p>
  );
}
