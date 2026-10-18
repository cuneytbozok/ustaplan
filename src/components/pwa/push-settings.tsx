"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, CheckCircle2, Send } from "lucide-react";
import { isPushSubscribed, removePushSubscription, savePushSubscription, sendTestPush } from "@/actions/push";
import { detectPlatform } from "./install-guide";

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "unsupported" }
  | { kind: "ios-install" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

const primaryClass =
  "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70";
const secondaryClass =
  "flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-medium text-ink hover:bg-muted disabled:opacity-60";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function applicationServerKey(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * Ayarlar → Bildirimler (plan §9): iPhone outside the installed app gets the
 * install note only, without a permission prompt; otherwise enable (asks
 * permission on tap), disable on this device, and a test push to this device.
 * "On" is shown only when the server has this device for this artisan.
 */
export function PushSettings() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let current = true;
    (async (): Promise<State> => {
      if (!PUBLIC_KEY) return { kind: "unconfigured" };
      if (detectPlatform() === "ios") return { kind: "ios-install" };
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return { kind: "unsupported" };
      if (Notification.permission === "denied") return { kind: "denied" };
      const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted" && (await isPushSubscribed(subscription.endpoint))) {
        return { kind: "on", endpoint: subscription.endpoint };
      }
      return { kind: "off" };
    })()
      .then((next) => current && setState(next))
      .catch(() => current && setState({ kind: "off" }));
    return () => {
      current = false;
    };
  }, []);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        // Must stay inside the tap: iOS only shows the prompt for a user gesture.
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? { kind: "denied" } : { kind: "off" });
          return;
        }
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const subscription =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(PUBLIC_KEY) }));
        const result = await savePushSubscription(subscription.toJSON());
        if (!result.ok) return setMessage({ ok: false, text: result.error });
        setState({ kind: "on", endpoint: subscription.endpoint });
        setMessage({ ok: true, text: "Bildirimler bu cihazda açıldı." });
      } catch {
        setMessage({ ok: false, text: "Bildirimler açılamadı. Tekrar dene." });
      }
    });
  }

  function disable(endpoint: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await removePushSubscription(endpoint);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      try {
        await (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription())?.unsubscribe();
      } catch {
        // The server no longer sends to it; the browser copy is harmless.
      }
      setState({ kind: "off" });
      setMessage({ ok: true, text: "Bildirimler bu cihazda kapatıldı." });
    });
  }

  function test(endpoint: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await sendTestPush(endpoint);
      if (!result.ok) {
        // An expired device record is removed on the server: show "off" again.
        if (!(await isPushSubscribed(endpoint))) setState({ kind: "off" });
        return setMessage({ ok: false, text: result.error });
      }
      setMessage({ ok: true, text: "Test bildirimi gönderildi. Birkaç saniye içinde gelmeli; uygulamayı kapatıp da deneyebilirsin." });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {state.kind === "loading" ? <div className="h-12" aria-hidden /> : null}
      {state.kind === "unconfigured" ? <p className="text-sm text-muted-foreground">Bildirimler henüz yapılandırılmadı.</p> : null}
      {state.kind === "unsupported" ? <p className="text-sm text-muted-foreground">Bu tarayıcı bildirimleri desteklemiyor. Telefonunda Chrome ya da ana ekrana eklenmiş UstaPlan&apos;ı kullan.</p> : null}
      {state.kind === "ios-install" ? (
        <p className="text-sm text-ink">
          iPhone&apos;da bildirim alabilmek için önce UstaPlan&apos;ı ana ekrana ekle (aşağıdaki adımlar), sonra ana ekrandaki simgeden açıp buradan etkinleştir.
        </p>
      ) : null}
      {state.kind === "denied" ? (
        <p className="text-sm text-ink">
          Bildirim izni bu cihazda kapalı. Telefonun <strong>Ayarlar → Bildirimler</strong> bölümünden UstaPlan&apos;a izin ver, sonra bu sayfayı yeniden aç.
        </p>
      ) : null}
      {state.kind === "off" ? (
        <button type="button" disabled={pending} onClick={enable} className={primaryClass}>
          <BellRing className="size-5" aria-hidden />
          {pending ? "Açılıyor…" : "Bildirimleri etkinleştir"}
        </button>
      ) : null}
      {state.kind === "on" ? (
        <>
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
            Bildirimler bu cihazda açık.
          </p>
          <button type="button" disabled={pending} onClick={() => test(state.endpoint)} className={secondaryClass}>
            <Send className="size-4" aria-hidden />
            {pending ? "Gönderiliyor…" : "Test bildirimi gönder"}
          </button>
          <button type="button" disabled={pending} onClick={() => disable(state.endpoint)} className={secondaryClass}>
            <BellOff className="size-4" aria-hidden />
            Bu cihazda kapat
          </button>
        </>
      ) : null}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "rounded-xl bg-primary-soft px-3 py-2.5 text-sm text-ink" : "rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger"}>
          {message.text}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Müşteri işi iptal ettiğinde, yeni tarih istediğinde ya da önerdiğin saati kabul ettiğinde bildirim gelir. Bildirimlerin ulaşması garanti değildir; telefonun izinlerine ve bağlantına bağlıdır. iPhone&apos;da iOS 16.4 ve üstü gerekir. Önemli her şey Bugün ekranında ve bildirim kutusunda her zaman görünür.
      </p>
    </div>
  );
}
