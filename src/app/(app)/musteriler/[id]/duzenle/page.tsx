import type { Metadata } from "next";
import { Suspense } from "react";
import { updateCustomer } from "@/actions/customers";
import { BackLink } from "@/components/common/back-link";
import { PageHeader } from "@/components/common/page-header";
import { NotFoundState } from "@/components/common/not-found-state";
import { ListSkeleton } from "@/components/common/skeleton";
import { CustomerForm } from "@/components/customers/customer-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Müşteriyi düzenle" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditCustomerPage({ params }: PageProps<"/musteriler/[id]/duzenle">) {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <EditCustomer params={params} />
    </Suspense>
  );
}

async function EditCustomer({ params }: { params: PageProps<"/musteriler/[id]/duzenle">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) return <NotFoundState backHref="/musteriler" backLabel="Müşterilere dön" />;
  const supabase = await createClient();
  const { data: customer, error } = await supabase.from("customers").select("id, name, phone, private_note").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return <NotFoundState backHref="/musteriler" backLabel="Müşterilere dön" />;

  return (
    <>
      <BackLink href={`/musteriler/${customer.id}`} />
      <PageHeader title="Müşteriyi düzenle" />
      <section className="rounded-2xl border border-border bg-surface p-4">
        <CustomerForm
          action={updateCustomer.bind(null, customer.id)}
          initial={{ name: customer.name, phone: customer.phone ?? "", privateNote: customer.private_note ?? "" }}
          submitLabel="Değişiklikleri kaydet"
          doneHref={`/musteriler/${customer.id}`}
        />
      </section>
    </>
  );
}
