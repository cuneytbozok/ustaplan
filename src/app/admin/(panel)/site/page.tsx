import type { Metadata } from "next";
import { Suspense } from "react";
import { formatMoment } from "@/components/admin/admin-bits";
import { SearchVisibilityAction } from "@/components/admin/search-visibility";
import { PageHeader } from "@/components/common/page-header";
import { ListSkeleton } from "@/components/common/skeleton";
import { requireAdmin } from "@/lib/admin/auth";
import { getSearchVisibilitySetting } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Site" };

export default function SitePage() {
  return (
    <>
      <PageHeader title="Site" subtitle="Herkese açık tanıtım sayfasıyla (ana sayfa) ilgili ayarlar." />
      <Suspense fallback={<ListSkeleton rows={1} />}>
        <Visibility />
      </Suspense>
    </>
  );
}

async function Visibility() {
  await requireAdmin();
  const { visible, updatedAt } = await getSearchVisibilitySetting();
  return (
    <section className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink">Arama motorlarında görünürlük</h2>
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
            visible ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {visible ? "Görünür" : "Gizli"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {visible
          ? "Google gibi arama motorları ana sayfayı listeleyebilir. Uygulamanın içi, giriş sayfası, müşteri bağlantıları ve bu panel her zaman gizli kalır."
          : "Ana sayfa herkese açık ama arama motorlarından gizli: robots.txt taramayı kapatır, sayfa “noindex” der. Testler bitince açabilirsin."}
      </p>
      <p className="text-xs text-muted-foreground">Son değişiklik: {formatMoment(updatedAt, "hiç değiştirilmedi (varsayılan: gizli)")}</p>
      <SearchVisibilityAction key={String(visible)} visible={visible} />
      <p className="text-xs text-muted-foreground">
        Açtıktan sonra arama sonuçlarında çıkması günler sürebilir. Hızlandırmak için Google Search Console&apos;a siteyi ve sitemap.xml adresini ekleyebilirsin.
      </p>
    </section>
  );
}
