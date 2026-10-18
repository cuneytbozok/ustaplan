"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Link2, MessageCircle, RefreshCw } from "lucide-react";
import { regenerateShareLink, setShareEnabled } from "@/actions/share";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const rowClass =
  "flex h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 text-base font-medium text-ink hover:bg-muted disabled:opacity-60";

/**
 * Customer link (plan §5): copy, WhatsApp with a ready message, close/open,
 * regenerate. `url` is null when the server can't sign links (missing secret).
 */
export function ShareSheet({
  jobId,
  url,
  enabled,
  version,
  whatsapp,
  defaultOpen = false,
}: {
  jobId: string;
  url: string | null;
  enabled: boolean;
  version: number;
  /** wa.me link with the prepared text: to the customer's number when known, otherwise WhatsApp's contact picker. */
  whatsapp: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Offer after "İşi kaydet": open once the page has settled (opening during the
  // navigation is dismissed by the focus leaving the old form).
  useEffect(() => {
    if (!defaultOpen) return;
    const timer = setTimeout(() => setOpen(true), 150);
    return () => clearTimeout(timer);
  }, [defaultOpen]);

  const run = (action: () => ReturnType<typeof setShareEnabled>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error);
      setConfirming(false);
    });

  async function copy() {
    if (!url) return;
    let done = false;
    try {
      await navigator.clipboard.writeText(url);
      done = true;
    } catch {
      // Older iOS / embedded browsers: copy through a temporary selection.
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      done = document.execCommand("copy");
      area.remove();
    }
    if (done) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Kopyalanamadı. Bağlantıyı basılı tutup kopyalayabilirsin.");
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Drop ?paylas once the offer is dismissed, so a reload doesn't offer again.
        if (!next && defaultOpen) window.history.replaceState(window.history.state, "", window.location.pathname);
        setConfirming(false);
        setError(null);
      }}
    >
      <SheetTrigger className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-semibold text-ink hover:bg-muted">
        <Link2 className="size-5" aria-hidden />
        Müşteriyle paylaş
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[95dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="pr-14">
          <SheetTitle className="text-lg font-semibold text-ink">Müşteri bağlantısı</SheetTitle>
          <SheetDescription>
            Müşteri bu bağlantıdan işin durumunu, randevuyu, paylaştığın fotoğrafları ve (açtıysan) anlaşılan fiyatı görür. Adresini,
            telefonunu, notlarını ve tahmini fiyatı görmez.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-4">
          {!url ? (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
              Bağlantı şu an oluşturulamıyor (sunucu ayarı eksik).
            </p>
          ) : enabled ? (
            <>
              <p className="rounded-xl bg-muted px-3 py-2.5 text-xs break-all text-ink select-all">{url}</p>
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" className={cn(rowClass, "border-primary bg-primary text-primary-foreground hover:bg-primary/90")}>
                  <MessageCircle className="size-5" aria-hidden />
                  WhatsApp ile gönder
                </a>
              ) : null}
              <button type="button" onClick={copy} className={rowClass}>
                <Copy className="size-5 text-muted-foreground" aria-hidden />
                {copied ? "Kopyalandı" : "Bağlantıyı kopyala"}
              </button>
              {confirming ? (
                <div role="alertdialog" aria-label="Yeni bağlantı oluşturulsun mu?" className="rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <p className="text-sm text-ink">Eski bağlantı hemen çalışmaz hale gelir. Müşteriye yeni bağlantıyı göndermen gerekir.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted">
                      Vazgeç
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => regenerateShareLink(jobId, version))}
                      className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
                    >
                      {pending ? "Oluşturuluyor…" : "Yeni bağlantı"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={pending} onClick={() => setConfirming(true)} className={rowClass}>
                  <RefreshCw className="size-5 text-muted-foreground" aria-hidden />
                  Yeni bağlantı oluştur
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setShareEnabled(jobId, false))}
                className="h-11 rounded-xl text-sm font-medium text-danger hover:bg-danger/10"
              >
                {pending ? "Kaydediliyor…" : "Bağlantıyı kapat"}
              </button>
            </>
          ) : (
            <>
              <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-ink">Bağlantı kapalı. Müşteri sayfayı açamaz.</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setShareEnabled(jobId, true))}
                className={cn(rowClass, "justify-center border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary/90")}
              >
                {pending ? "Kaydediliyor…" : "Bağlantıyı aç"}
              </button>
            </>
          )}
          {error ? (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
