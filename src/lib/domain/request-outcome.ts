// What became of a customer's date request since its notification was sent
// (owner feedback, M5.7): a push or inbox item can be older than the request's
// current state. One place for the job-page banner and the inbox label; sen tone.

import { formatDate, formatTime } from "./time";

export type RequestOutcomeInput = {
  status: string;
  jobStatus: string;
  /** Start of the visit the request turned into, when accepted. */
  resultingStartsAt: string | null;
  /** The newest request for the same visit, when the customer asked again after this one. */
  latest: { status: string; resultingStartsAt: string | null } | null;
};

const at = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;

/** When the customer asked again: follow the chain to where the newest request stands. */
function replacedMessage(latest: NonNullable<RequestOutcomeInput["latest"]>, jobStatus: string) {
  const asked = "Müşteri bu talebin yerine başka bir tarih istedi";
  switch (latest.status) {
    case "pending_artisan":
      return `${asked}; yeni talep aşağıda.`;
    case "pending_customer":
      return `${asked}; ona başka bir saat önerdin, yanıtı bekleniyor.`;
    case "withdrawn":
      return `${asked}, sonra onu da geri çekti. Randevu aynı kaldı.`;
    case "rejected":
      return `${asked}; onu reddettin. Randevu aynı kaldı.`;
    case "accepted":
      return latest.resultingStartsAt ? `${asked} ve kabul edildi. Yeni randevu: ${at(latest.resultingStartsAt)}.` : `${asked} ve kabul edildi.`;
    default:
      return `${asked}; o talep de kapandı${jobStatus === "cancelled" ? " (iş iptal edildi)" : ""}.`;
  }
}

/** One sentence for the top of the job page, or null while the request still waits (its card is shown). */
export function requestOutcomeMessage(r: RequestOutcomeInput): string | null {
  if (r.latest && r.status === "withdrawn") return replacedMessage(r.latest, r.jobStatus);
  switch (r.status) {
    case "withdrawn":
      return "Müşteri bu tarih talebini geri çekti. Randevu aynı kaldı.";
    case "rejected":
      return "Bu talebi reddettin. Randevu aynı kaldı.";
    case "accepted":
      return r.resultingStartsAt
        ? `Bu talep kabul edildi. Yeni randevu: ${at(r.resultingStartsAt)}.`
        : "Bu talep kabul edildi.";
    case "closed":
      return r.jobStatus === "cancelled"
        ? "İş iptal edildiği için bu talep kapandı."
        : r.jobStatus === "completed"
          ? "İş tamamlandığı için bu talep kapandı."
          : "Randevu değiştiği ya da kapandığı için bu talep kapandı.";
    default:
      return null;
  }
}

/** Short status after a date-request inbox item; null while it needs the artisan's answer. */
export function requestStatusLabel(status: string, replaced: boolean): string | null {
  switch (status) {
    case "pending_customer":
      return "Müşterinin yanıtı bekleniyor";
    case "accepted":
      return "Kabul edildi";
    case "rejected":
      return "Reddettin";
    case "withdrawn":
      return replaced ? "Yerine yeni tarih istendi" : "Geri çekildi";
    case "closed":
      return "Kapandı";
    default:
      return null;
  }
}
