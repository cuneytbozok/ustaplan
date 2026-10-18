"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { INVALID_LINK_MESSAGE } from "@/components/public/invalid-link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { prepareImage } from "@/lib/media/prepare-image";
import type { CustomerJobView } from "@/lib/public-job";

type Photo = CustomerJobView["photos"][number];

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger">
      {error}
    </p>
  ) : null;
}

/** POST/DELETE to the customer API; returns null on success or a siz-tone message. */
async function send(url: string, init: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, init);
    if (response.status === 404 && !response.headers.get("content-type")?.includes("json")) return INVALID_LINK_MESSAGE;
    const result = (await response.json()) as { ok: boolean; error?: string };
    return result.ok ? null : (result.error ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
  } catch {
    return "Bağlantı kurulamadı. Lütfen tekrar deneyin.";
  }
}

/**
 * Customer photos (spec §5.4, siz tone): add from camera or gallery (prepared
 * in the browser: ≤ 1600 px JPEG, no EXIF/GPS), delete own uploads after a
 * confirmation. The list refreshes only after the server confirmed.
 */
export function CustomerPhotos({ token, photos, canUpload }: { token: string; photos: Photo[]; canUpload: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Photo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList) {
    setError(null);
    const list = [...files];
    try {
      for (const [index, file] of list.entries()) {
        const step = list.length > 1 ? ` ${index + 1}/${list.length}` : "";
        setStatus(`Hazırlanıyor${step}…`);
        let blob: Blob;
        try {
          blob = await prepareImage(file);
        } catch {
          setError("Bu fotoğraf açılamadı. Lütfen başka bir fotoğraf seçin.");
          return;
        }
        setStatus(`Yükleniyor${step}…`);
        const body = new FormData();
        body.append("photo", blob, "photo.jpg");
        const failure = await send(`/api/t/${token}/photos`, { method: "POST", body });
        if (failure) {
          setError(failure);
          return;
        }
      }
    } finally {
      setStatus(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  function remove(photo: Photo) {
    setDeleteError(null);
    startTransition(async () => {
      const failure = await send(`/api/t/${token}/photos/${photo.id}`, { method: "DELETE" });
      if (failure) return setDeleteError(failure);
      setDeleting(null);
      router.refresh();
    });
  }

  if (!photos.length && !canUpload) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Fotoğraflar</h2>
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <a href={photo.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- token-verified media proxy */}
                <img src={photo.url} alt={photo.fromCustomer ? "Sizin eklediğiniz fotoğraf" : "Ustanızın paylaştığı fotoğraf"} loading="lazy" className="size-full object-cover" />
              </a>
              {photo.canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(photo);
                  }}
                  aria-label="Fotoğrafı sil"
                  className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-surface/90 text-danger shadow-sm"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">Sorunu gösteren fotoğraflar ustanızın hazırlanmasına yardımcı olur.</p>
      )}

      {canUpload ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            aria-label="Fotoğraf seçin"
            onChange={(event) => event.target.files?.length && upload(event.target.files)}
          />
          <button
            type="button"
            disabled={status !== null}
            onClick={() => input.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-base font-medium text-ink hover:bg-muted disabled:opacity-60"
          >
            <ImagePlus className="size-5" aria-hidden />
            {status ?? "Fotoğraf ekle"}
          </button>
          <p className="text-xs text-muted-foreground">Ustanız görür. Konum bilgisi fotoğraftan silinir.</p>
          <ErrorLine error={error} />
        </div>
      ) : null}

      <Sheet open={deleting !== null} onOpenChange={(open) => !open && !pending && setDeleting(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="pr-14">
            <SheetTitle className="text-lg font-semibold text-ink">Fotoğraf silinsin mi?</SheetTitle>
            <SheetDescription>Fotoğraf ustanızdan da kaldırılır.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {deleting ? (
              // eslint-disable-next-line @next/next/no-img-element -- token-verified media proxy
              <img src={deleting.url} alt="Silinecek fotoğraf" className="max-h-[40dvh] w-full rounded-xl bg-muted object-contain" />
            ) : null}
            <ErrorLine error={deleteError} />
            <button
              type="button"
              disabled={pending}
              onClick={() => deleting && remove(deleting)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-danger text-base font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
            >
              <Trash2 className="size-5" aria-hidden />
              {pending ? "Siliniyor…" : "Evet, sil"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeleting(null)}
              className="h-11 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Vazgeç
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
