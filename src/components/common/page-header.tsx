import { BackLink } from "@/components/common/back-link";

/** Page title; with `backHref` the back button sits on the same row (compact sub-page header). */
export function PageHeader({ title, subtitle, backHref }: { title: string; subtitle?: React.ReactNode; backHref?: string }) {
  if (backHref) {
    return (
      <div className="-mt-2 flex items-center gap-1">
        <BackLink href={backHref} iconOnly />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
