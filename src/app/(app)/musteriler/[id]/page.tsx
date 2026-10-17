import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import { deleteCustomer } from "@/actions/customers";
import { BackLink } from "@/components/common/back-link";
import { ConfirmAction } from "@/components/common/confirm-action";
import { NotFoundState } from "@/components/common/not-found-state";
import { ListSkeleton } from "@/components/common/skeleton";
import { AddressSection } from "@/components/customers/address-section";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS_LABELS } from "@/lib/domain/labels";
import { whatsappHref } from "@/lib/domain/links";
import { formatPhone, telHref } from "@/lib/domain/phone";
import { formatShortDate } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Müşteri" };

export default function CustomerPage({ params }: PageProps<"/musteriler/[id]">) {
  return (
    <>
      <BackLink href="/musteriler" label="Müşteriler" />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <CustomerDetail params={params} />
      </Suspense>
    </>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function CustomerDetail({ params }: { params: PageProps<"/musteriler/[id]">["params"] }) {
  const { id } = await params;
  if (!UUID.test(id)) return <NotFoundState backHref="/musteriler" backLabel="Müşterilere dön" />;

  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, phone, private_note, customer_addresses(id, label, address_text, created_at), jobs(id, title, status, created_at)")
    .eq("id", id)
    .order("created_at", { referencedTable: "customer_addresses" })
    .order("created_at", { referencedTable: "jobs", ascending: false })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!customer) return <NotFoundState backHref="/musteriler" backLabel="Müşterilere dön" />; // includes other artisans' customers (RLS hides them)

  return (
    <>
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight break-words text-ink">{customer.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{customer.phone ? formatPhone(customer.phone) : "Telefon kayıtlı değil"}</p>
          </div>
          <Link
            href={`/musteriler/${customer.id}/duzenle`}
            aria-label="Müşteriyi düzenle"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-ink hover:bg-muted"
          >
            <Pencil className="size-5" aria-hidden />
          </Link>
        </div>

        {customer.phone ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={telHref(customer.phone)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-semibold text-ink hover:bg-muted"
            >
              <Phone className="size-5" aria-hidden />
              Ara
            </a>
            <a
              href={whatsappHref(customer.phone)}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-semibold text-ink hover:bg-muted"
            >
              <MessageCircle className="size-5" aria-hidden />
              WhatsApp
            </a>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Arama ve WhatsApp için telefon numarası ekle.</p>
        )}

        {customer.private_note ? (
          <div className="mt-4 rounded-xl bg-muted px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Özel not · Sadece sen görürsün</p>
            <p className="mt-1 text-sm break-words whitespace-pre-line text-ink">{customer.private_note}</p>
          </div>
        ) : null}
      </section>

      <AddressSection customerId={customer.id} addresses={customer.customer_addresses} />

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">İşler</h2>
          <Link
            href={`/isler/yeni?musteri=${customer.id}`}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden />
            Yeni iş
          </Link>
        </div>
        {customer.jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu müşteriye ait iş yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {customer.jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm text-ink">{job.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS]} · {formatShortDate(job.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {customer.jobs.length === 0 ? (
        <ConfirmAction
          action={deleteCustomer.bind(null, customer.id)}
          label="Müşteriyi sil"
          confirmLabel="Sil"
          question={`${customer.name} ve kayıtlı adresleri silinsin mi? Bu işlem geri alınamaz.`}
        />
      ) : (
        <p className="text-center text-xs text-muted-foreground">İşleri olan müşteri silinemez.</p>
      )}
    </>
  );
}
