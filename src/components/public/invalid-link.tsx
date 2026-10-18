import { LinkIcon } from "lucide-react";

/** The single answer for malformed, unknown, disabled and regenerated links (plan §5). */
export const INVALID_LINK_MESSAGE = "Bu bağlantı geçersiz veya kapatılmış.";

export function InvalidLink() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <LinkIcon className="size-6" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-ink">{INVALID_LINK_MESSAGE}</h1>
      <p className="text-sm text-muted-foreground">Güncel bağlantı için lütfen ustanızla iletişime geçin.</p>
    </main>
  );
}
