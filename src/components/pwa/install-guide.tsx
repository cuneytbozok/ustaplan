"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Download, EllipsisVertical, Share } from "lucide-react";
import { clearInstallPrompt, getInstallPrompt, onInstallPromptChange } from "./pwa-setup";

type Platform = "standalone" | "ios" | "other";

function detect(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-ink marker:font-semibold marker:text-primary">{children}</ol>;
}

/**
 * "Uygulamayı ana ekrana ekle" (plan §9/§10): already installed, iPhone steps
 * (needed for notifications on iOS 16.4+), or Android's install button when
 * the browser offered one, otherwise the menu steps.
 */
export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Browser-only facts: read after mount so server and client markup match.
    const update = () => {
      setPlatform(detect());
      setCanPrompt(getInstallPrompt() !== null);
    };
    update();
    const unsubscribe = onInstallPromptChange(update);
    return () => {
      unsubscribe();
    };
  }, []);

  if (platform === null) return <div className="h-16" aria-hidden />;

  if (platform === "standalone") {
    return (
      <p className="flex items-start gap-2 text-sm text-ink">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        UstaPlan bu cihazda uygulama olarak açık.
      </p>
    );
  }

  if (platform === "ios") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Ana ekrana eklersen UstaPlan tam ekran açılır. iPhone&apos;da bildirim alabilmek için de bu adım gerekli (iOS 16.4 ve üstü).
        </p>
        <Steps>
          <li>
            Safari&apos;de alttaki <Share className="inline size-4 align-text-bottom" aria-label="Paylaş" /> <strong>Paylaş</strong> simgesine dokun.
          </li>
          <li>
            Listeden <strong>Ana Ekrana Ekle</strong>&apos;yi seç (görmüyorsan listeyi aşağı kaydır).
          </li>
          <li>
            Sağ üstte <strong>Ekle</strong>&apos;ye dokun.
          </li>
          <li>UstaPlan&apos;ı bundan sonra ana ekrandaki simgeden aç.</li>
        </Steps>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Ana ekrana eklersen UstaPlan tam ekran, bir uygulama gibi açılır.</p>
      {canPrompt ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const prompt = getInstallPrompt();
              if (!prompt) return;
              await prompt.prompt();
              await prompt.userChoice;
              clearInstallPrompt(); // the browser offers it only once
            })
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          <Download className="size-5" aria-hidden />
          Uygulamayı yükle
        </button>
      ) : (
        <Steps>
          <li>
            Chrome&apos;da sağ üstteki <EllipsisVertical className="inline size-4 align-text-bottom" aria-label="menü" /> menüsüne dokun.
          </li>
          <li>
            <strong>Uygulamayı yükle</strong> ya da <strong>Ana ekrana ekle</strong>&apos;yi seç.
          </li>
          <li>UstaPlan&apos;ı bundan sonra ana ekrandaki simgeden aç.</li>
        </Steps>
      )}
    </div>
  );
}
