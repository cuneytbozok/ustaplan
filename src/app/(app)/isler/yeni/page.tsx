import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/common/back-link";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { NewJobForm } from "@/components/jobs/new-job-form";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DURATION_MINUTES, pickerDefaults } from "@/lib/domain/scheduling";

export const metadata: Metadata = { title: "Yeni iş" };

const RECENT = 6;

export default function NewJobPage({ searchParams }: PageProps<"/isler/yeni">) {
  return (
    <>
      <BackLink href="/isler" />
      <PageHeader title="Yeni iş" />
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <NewJob searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewJob({ searchParams }: { searchParams: PageProps<"/isler/yeni">["searchParams"] }) {
  const { musteri } = await searchParams;
  const supabase = await createClient();
  const [customersResult, jobsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, updated_at, customer_addresses(id, label, address_text)")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase.from("jobs").select("customer_id").order("created_at", { ascending: false }).limit(50),
  ]);
  if (customersResult.error) throw new Error(customersResult.error.message);
  if (jobsResult.error) throw new Error(jobsResult.error.message);

  const customers = customersResult.data.map((c) => ({ id: c.id, name: c.name, addresses: c.customer_addresses }));
  // Recent = customers of the latest jobs, then recently added/edited customers.
  const recentIds = [...new Set([...jobsResult.data.map((j) => j.customer_id), ...customers.map((c) => c.id)])].slice(0, RECENT);
  const initialCustomerId = typeof musteri === "string" && customers.some((c) => c.id === musteri) ? musteri : undefined;

  const { today, tomorrow, date, time } = pickerDefaults();
  return (
    <NewJobForm
      customers={customers}
      recentIds={recentIds}
      initialCustomerId={initialCustomerId}
      picker={{ today, tomorrow, initial: { date, time, duration: DEFAULT_DURATION_MINUTES } }}
    />
  );
}
