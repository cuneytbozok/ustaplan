import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, SearchX, Users } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { SearchBox } from "@/components/common/search-box";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/domain/phone";
import { readQuery, searchKeyPattern } from "@/lib/search";

export const metadata: Metadata = { title: "Müşteriler" };

export default function CustomersPage({ searchParams }: PageProps<"/musteriler">) {
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <PageHeader title="Müşteriler" />
        <Link
          href="/musteriler/yeni"
          className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" aria-hidden />
          Yeni müşteri
        </Link>
      </div>
      <Suspense fallback={<div className="h-12 rounded-xl border border-border bg-surface" />}>
        <SearchBox label="Müşteri ara" placeholder="Ad veya telefonla ara" />
      </Suspense>
      <Suspense fallback={<ListSkeleton />}>
        <CustomerList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerList({ searchParams }: { searchParams: PageProps<"/musteriler">["searchParams"] }) {
  const { q } = await searchParams;
  const query = readQuery(q);

  const supabase = await createClient();
  let request = supabase
    .from("customers")
    .select("id, name, phone, customer_addresses(count)")
    .order("name")
    .limit(200);
  if (query) request = request.ilike("search_key", searchKeyPattern(query));
  const { data: customers, error } = await request;
  if (error) throw new Error(error.message);

  if (!customers.length) {
    return query ? (
      <EmptyState icon={SearchX} title="Sonuç yok" description={`“${query}” ile eşleşen müşteri bulunamadı.`} />
    ) : (
      <EmptyState
        icon={Users}
        title="Henüz müşterin yok"
        description="İlk müşterini ekle. Telefonunu da yazarsan tek dokunuşla arayabilir veya WhatsApp'tan yazabilirsin."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {customers.map((customer) => {
        const addressCount = customer.customer_addresses[0]?.count ?? 0;
        return (
          <li key={customer.id}>
            <Link
              href={`/musteriler/${customer.id}`}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ink">{customer.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[customer.phone ? formatPhone(customer.phone) : "Telefon yok", addressCount ? `${addressCount} adres` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
