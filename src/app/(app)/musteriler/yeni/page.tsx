import type { Metadata } from "next";
import { createCustomer } from "@/actions/customers";
import { BackLink } from "@/components/common/back-link";
import { PageHeader } from "@/components/common/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const metadata: Metadata = { title: "Yeni müşteri" };

export default function NewCustomerPage() {
  return (
    <>
      <BackLink href="/musteriler" />
      <PageHeader title="Yeni müşteri" subtitle="Adresleri kaydettikten sonra ekleyebilirsin." />
      <section className="rounded-2xl border border-border bg-surface p-4">
        <CustomerForm action={createCustomer} submitLabel="Müşteriyi kaydet" />
      </section>
    </>
  );
}
