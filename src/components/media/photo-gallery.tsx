"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { deletePhoto, registerPhoto, setPhotoShared } from "@/actions/media";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { prepareImage } from "@/lib/media/prepare-image";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { formatShortDate } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export type GalleryPhoto = {
  id: string;
  jobId: string;
  url: string;
  origin: "artisan" | "customer";
  shared: boolean;
  createdAt: string;
  jobTitle?: string;
};

function UploadButton({ jobId, ownerId }: { jobId: string; ownerId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList) {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const list = [...files];
    try {
      for (const [index, file] of list.entries()) {
        setStatus(list.length > 1 ? `Hazırlanıyor ${index + 1}/${list.length}…` : "Hazırlanıyor…");
        const blob = await prepareImage(file);
        const mediaId = crypto.randomUUID();
        setStatus(list.length > 1 ? `Yükleniyor ${index + 1}/${list.length}…` : "Yükleniyor…");
        const { error: uploadError } = await supabase.storage
          .from("job-images")
          .upload(`${ownerId}/${jobId}/${mediaId}.jpg`, blob, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw new Error("Fotoğraf yüklenemedi. Bağlantını kontrol edip tekrar dene.");
        const result = await registerPhoto(jobId, mediaId);
        if (!result.ok) throw new Error(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fotoğraf yüklenemedi.");
    } finally {
      setStatus(null);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        aria-label="Fotoğraf seç"
        onChange={(event) => event.target.files?.length && upload(event.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-ink hover:bg-muted disabled:opacity-60"
      >
        <ImagePlus className="size-4" aria-hidden />
        {status ?? "Fotoğraf ekle"}
      </button>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Viewer({ photo, onClose, showJob }: { photo: GalleryPhoto; onClose: () => void; showJob: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (action: () => ReturnType<typeof deletePhoto>, closeAfter: boolean) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else if (closeAfter) onClose();
    });

  return (
    <SheetContent side="bottom" className="max-h-[95dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
      <SheetHeader className="pr-14">
        <SheetTitle className="text-base font-semibold text-ink">Fotoğraf · {formatShortDate(photo.createdAt)}</SheetTitle>
        <SheetDescription>
          {photo.origin === "customer" ? "Müşteri ekledi · Müşteri görür" : photo.shared ? "Müşteri görür" : "Sadece sen görürsün"}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 overflow-y-auto px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, already sized in the browser */}
        <img src={photo.url} alt="İş fotoğrafı" className="max-h-[60dvh] w-full rounded-xl bg-muted object-contain" />
        {showJob && photo.jobTitle ? (
          <Link href={`/isler/${photo.jobId}`} className="text-sm font-medium text-primary">
            İş: {photo.jobTitle}
          </Link>
        ) : null}
        {photo.origin === "artisan" ? (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-4 text-sm font-medium text-ink">
            <span>
              Müşteriyle paylaş
              <span className="block text-xs font-normal text-muted-foreground">Açıksa müşteri bağlantısında görünür.</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={photo.shared}
              disabled={pending}
              onChange={(event) => run(() => setPhotoShared(photo.id, event.target.checked), false)}
              className="size-5 shrink-0 accent-primary"
            />
          </label>
        ) : null}
        {confirming ? (
          <div role="alertdialog" aria-label="Fotoğraf silinsin mi?" className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <p className="text-sm text-ink">Fotoğraf silinsin mi? Bu işlem geri alınamaz.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deletePhoto(photo.id), true)}
                className="h-11 rounded-xl bg-danger text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
              >
                {pending ? "Siliniyor…" : "Sil"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" aria-hidden />
            Fotoğrafı sil
          </button>
        )}
        {error ? (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </SheetContent>
  );
}

/** Photo grid with viewer. With `upload`, also the "Fotoğraf ekle" button (job page). */
export function PhotoGallery({
  photos,
  upload,
  showJob = false,
  emptyText,
}: {
  photos: GalleryPhoto[];
  upload?: { jobId: string; ownerId: string };
  showJob?: boolean;
  emptyText: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = photos.find((p) => p.id === openId);

  return (
    <div className="flex flex-col gap-3">
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpenId(photo.id)}
                aria-label={`Fotoğrafı aç, ${formatShortDate(photo.createdAt)}`}
                className="relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
                <img src={photo.url} alt="" loading="lazy" className="size-full object-cover" />
                {photo.origin === "customer" || photo.shared ? (
                  <span
                    className={cn(
                      "absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      photo.origin === "customer" ? "bg-ink/80 text-white" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {photo.origin === "customer" ? "Müşteri" : "Paylaşıldı"}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {upload ? <UploadButton jobId={upload.jobId} ownerId={upload.ownerId} /> : null}
      <Sheet open={Boolean(open)} onOpenChange={(next) => !next && setOpenId(null)}>
        {open ? <Viewer key={open.id} photo={open} onClose={() => setOpenId(null)} showJob={showJob} /> : null}
      </Sheet>
    </div>
  );
}
