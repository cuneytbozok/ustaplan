import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBackLink, ArtisanStatus, formatMoment } from "@/components/admin/admin-bits";
import { ActiveAction, ResetPasswordAction } from "@/components/admin/artisan-actions";
import { NotFoundState } from "@/components/common/not-found-state";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";
import { getArtisanRows } from "@/lib/admin/stats";

export const metadata: Metadata = { title: "Usta" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ArtisanPage({ params }: PageProps<"/admin/ustalar/[id]">) {
  return (
    <>
      <AdminBackLink href="/admin/ustalar" label="Ustalar" />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <ArtisanDetail params={params} />
      </Suspense>
    </>
  );
}

async function ArtisanDetail({ params }: { params: PageProps<"/admin/ustalar/[id]">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  const row = UUID.test(id) ? (await getArtisanRows()).find((artisan) => artisan.id === id) : undefined;
  if (!row) return <NotFoundState backHref="/admin/ustalar" backLabel="Ustalara dön" />;

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{row.displayName}</h1>
          <ArtisanStatus active={row.active} />
        </div>
        <p className="text-sm text-muted-foreground">
          {row.email}
          {row.businessName ? ` · ${row.businessName}` : ""}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Müşteri", value: row.customers },
          { label: "Toplam iş", value: row.jobs.total },
          { label: "Açık iş", value: row.jobs.open },
          { label: "Tamamlanan", value: row.jobs.completed },
          { label: "İptal edilen", value: row.jobs.cancelled },
          { label: "Son 30 günde iş", value: row.jobs.last30Days },
          { label: "Bildirim cihazı", value: row.pushDevices },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{value.toLocaleString("tr-TR")}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Hesap açıldı</dt>
            <dd className="font-medium text-ink">{formatMoment(row.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Son giriş</dt>
            <dd className="font-medium text-ink">{formatMoment(row.lastSignInAt, "Hiç giriş yapmadı")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Son işlem</dt>
            <dd className="font-medium text-ink">{formatMoment(row.lastActivityAt, "Henüz yok")}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-ink">Şifre</h2>
        <p className="text-sm text-muted-foreground">Usta şifresini unuttuysa yeni bir geçici şifre oluştur ve ona özelden ilet.</p>
        <ResetPasswordAction userId={row.id} name={row.displayName} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-ink">Hesap durumu</h2>
        <ActiveAction key={String(row.active)} userId={row.id} name={row.displayName} active={row.active} />
      </section>
    </>
  );
}
