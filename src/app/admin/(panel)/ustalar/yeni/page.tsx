import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBackLink } from "@/components/admin/admin-bits";
import { CreateArtisanForm } from "@/components/admin/create-artisan-form";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Usta ekle" };

export default function NewArtisanPage() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-5">
      <AdminBackLink href="/admin/ustalar" label="Ustalar" />
      <PageHeader title="Usta ekle" subtitle="Hesap açılır ve bir geçici şifre bir kez gösterilir." />
      <div className="rounded-2xl border border-border bg-surface p-5">
        <Suspense fallback={<ListSkeleton rows={1} />}>
          <Gated />
        </Suspense>
      </div>
    </div>
  );
}

async function Gated() {
  await requireAdmin();
  return <CreateArtisanForm />;
}
