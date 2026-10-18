// Inbox and push copy (CLAUDE.md): the one place that turns a notification's
// category + payload snapshot into Turkish text, so the inbox (M5.4) and Web
// Push (M5.7) always say the same thing. Artisan tone (sen). Payloads come
// from the DB RPCs and route handlers; any field may be missing.

import { CANCEL_REASON_LABELS } from "@/lib/domain/labels";
import { formatDate, formatTime } from "@/lib/domain/time";

export type RenderedNotification = { title: string; body: string };

type Payload = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const when = (value: unknown) => {
  const iso = text(value);
  return iso && !Number.isNaN(Date.parse(iso)) ? `${formatDate(iso)}, ${formatTime(iso)}` : "";
};
const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");

export function renderNotification(category: string, payload: unknown): RenderedNotification {
  const p = (payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}) as Payload;
  const who = text(p.customer_first_name) || "Müşteri";
  const job = text(p.job_title);

  switch (category) {
    case "customer_cancelled": {
      const reason = CANCEL_REASON_LABELS[text(p.reason) as keyof typeof CANCEL_REASON_LABELS] ?? "";
      return { title: `${who} işi iptal etti`, body: join(job, reason) };
    }
    case "reschedule_requested":
      return { title: `${who} yeni tarih istedi`, body: join(job, when(p.starts_at)) };
    case "counter_accepted":
      return { title: `${who} önerdiğin saati kabul etti`, body: join(job, when(p.starts_at)) };
    case "request_withdrawn":
      return { title: `${who} tarih talebini geri çekti`, body: job };
    case "customer_photo_added": {
      const count = typeof p.count === "number" && p.count > 1 ? p.count : 1;
      return { title: count > 1 ? `${who} ${count} fotoğraf ekledi` : `${who} fotoğraf ekledi`, body: job };
    }
    default:
      return { title: "Yeni bildirim", body: job };
  }
}
