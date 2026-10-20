import type { Metadata } from "next";
import { Suspense } from "react";
import { updateJob } from "@/actions/jobs";
import { BackLink } from "@/components/common/back-link";
import { NotFoundState } from "@/components/common/not-found-state";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { EditJobForm } from "@/components/jobs/edit-job-form";
import { createClient } from "@/lib/supabase/server";
import { formatPriceInput } from "@/lib/domain/money";

export const metadata: Metadata = { title: "İşi düzenle" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditJobPage({ params }: PageProps<"/isler/[id]/duzenle">) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <EditJob params={params} />
    </Suspense>
  );
}

async function EditJob({ params }: { params: PageProps<"/isler/[id]/duzenle">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) return <NotFoundState backHref="/isler" backLabel="İşlere dön" />;

  const supabase = await createClient();
  const [jobResult, customersResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, customer_id, address_id, estimated_price, agreed_price, show_price_to_customer")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("customers").select("id, name, customer_addresses(id, label, address_text)").order("name").limit(500),
  ]);
  if (jobResult.error) throw new Error(jobResult.error.message);
  if (customersResult.error) throw new Error(customersResult.error.message);
  const job = jobResult.data;
  if (!job) return <NotFoundState backHref="/isler" backLabel="İşlere dön" />;

  const customers = customersResult.data.map((c) => ({ id: c.id, name: c.name, addresses: c.customer_addresses }));
  // Beyond the list limit, the job's own customer must still be selectable.
  if (!customers.some((c) => c.id === job.customer_id)) {
    const own = await supabase.from("customers").select("id, name, customer_addresses(id, label, address_text)").eq("id", job.customer_id).single();
    if (own.error) throw new Error(own.error.message);
    customers.unshift({ id: own.data.id, name: own.data.name, addresses: own.data.customer_addresses });
  }

  return (
    <>
      <BackLink href={`/isler/${job.id}`} />
      <PageHeader title="İşi düzenle" />
      <section className="rounded-2xl border border-border bg-surface p-4">
        <EditJobForm
          action={updateJob.bind(null, job.id)}
          customers={customers}
          doneHref={`/isler/${job.id}`}
          initial={{
            customerId: job.customer_id,
            title: job.title,
            addressId: job.address_id ?? "",
            agreedPrice: formatPriceInput(job.agreed_price),
            estimatedPrice: formatPriceInput(job.estimated_price),
            showPrice: job.show_price_to_customer,
          }}
        />
      </section>
    </>
  );
}
