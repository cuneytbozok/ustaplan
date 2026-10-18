import { CANCEL_REASON_LABELS, JOB_EVENT_LABELS, JOB_FIELD_LABELS, JOB_STATUS_LABELS } from "@/lib/domain/labels";
import { formatTRY } from "@/lib/domain/money";
import { formatShortDate, formatTime } from "@/lib/domain/time";
import type { Json } from "@/types/database";

export type JobEvent = { id: string; event_type: string; actor_type: string; payload: Json; created_at: string };
type Payload = Record<string, unknown>;

const price = (value: unknown) => (typeof value === "number" ? formatTRY(value) : "—");
const when = (value: unknown) => (typeof value === "string" ? `${formatShortDate(value)} ${formatTime(value)}` : undefined);
const status = (value: unknown) => JOB_STATUS_LABELS[value as keyof typeof JOB_STATUS_LABELS] ?? "—";

/** One line per event: headline plus the detail the payload allows (never phones or addresses). */
export function describeEvent(event: JobEvent): { title: string; detail?: string } {
  const p = (event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {}) as Payload;
  const field = JOB_FIELD_LABELS[String(p.field)];
  const cascade = (n: unknown) => (typeof n === "number" && n > 0 ? `${n} randevu iptal edildi` : undefined);

  switch (event.event_type) {
    case "price_changed":
      return { title: `${field ?? "Fiyat"} değişti`, detail: `${price(p.old)} → ${price(p.new)}` };
    case "price_visibility_changed":
      return { title: p.new ? "Anlaşılan fiyat müşteriye gösteriliyor" : "Fiyat müşteriden gizlendi" };
    case "job_updated":
      return p.field === "title"
        ? { title: "Yapılacak iş değişti", detail: String(p.new ?? "") }
        : { title: `${field ?? "İş"} değişti` };
    case "status_changed":
      return { title: `Durum: ${status(p.from)} → ${status(p.to)}`, detail: cascade(p.cancelled_appointments) };
    case "job_cancelled": {
      const reason = CANCEL_REASON_LABELS[p.reason as keyof typeof CANCEL_REASON_LABELS];
      return {
        title: p.by === "customer" ? "Müşteri işi iptal etti" : "İş iptal edildi",
        detail: [reason, cascade(p.cancelled_appointments)].filter(Boolean).join(" · ") || undefined,
      };
    }
    case "job_reopened":
      return { title: "İş yeniden açıldı", detail: `Önceki durum: ${status(p.from)}` };
    case "appointment_scheduled":
    case "appointment_completed":
    case "appointment_cancelled":
      return { title: JOB_EVENT_LABELS[event.event_type], detail: when(p.starts_at) };
    case "appointment_rescheduled":
      return { title: "Randevu yeniden planlandı", detail: `${when(p.old_starts_at) ?? "—"} → ${when(p.starts_at) ?? "—"}` };
    case "request_created":
    case "request_countered":
    case "request_accepted":
      return { title: JOB_EVENT_LABELS[event.event_type], detail: when(p.starts_at) };
    case "media_added":
    case "media_deleted":
      if (p.kind === "image") return { title: event.event_type === "media_added" ? "Fotoğraf eklendi" : "Fotoğraf silindi" };
      return { title: JOB_EVENT_LABELS[event.event_type] };
    default:
      return { title: JOB_EVENT_LABELS[event.event_type] ?? "Değişiklik" };
  }
}

export function JobTimeline({ events }: { events: JobEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>;
  return (
    <ol className="flex flex-col">
      {events.map((event) => {
        const { title, detail } = describeEvent(event);
        return (
          <li key={event.id} className="relative border-l border-border py-2 pl-4 last:pb-0">
            <span className="absolute top-3.5 -left-[5px] size-2.5 rounded-full border-2 border-surface bg-primary" aria-hidden />
            <p className="text-sm text-ink">{title}</p>
            {detail ? <p className="text-sm break-words text-muted-foreground">{detail}</p> : null}
            <p className="text-xs text-muted-foreground">
              {formatShortDate(event.created_at)} {formatTime(event.created_at)}
              {event.actor_type === "link_holder" ? " · Müşteri" : event.actor_type === "system" ? " · Sistem" : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
