import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { countOrThrow } from "@/lib/supabase/count";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Müşteriler" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Müşteriler" />
      <Suspense fallback={<ListSkeleton />}>
        <Customers />
      </Suspense>
    </>
  );
}

// The searchable list, forms and detail arrive in M1.6.
async function Customers() {
  const supabase = await createClient();
  const count = countOrThrow(await supabase.from("customers").select("id", { count: "exact", head: true }));

  return count === 0 ? (
    <EmptyState
      icon={Users}
      title="Henüz müşterin yok"
      description="Eklediğin müşteriler ve adresleri burada aranabilir bir listede görünür."
    />
  ) : (
    <p className="rounded-2xl border border-border bg-surface p-4 text-base text-ink">{count} müşterin var.</p>
  );
}
