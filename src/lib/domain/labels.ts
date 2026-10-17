// Turkish UI labels for the English DB codes (spec §3). The single place for
// these strings; push and inbox copy lives in lib/push/render.ts.

export const JOB_STATUS_LABELS = {
  unplanned: "Planlanacak",
  scheduled: "Planlandı",
  in_progress: "Devam ediyor",
  waiting_material: "Parça bekleniyor",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
} as const;
export type JobStatus = keyof typeof JOB_STATUS_LABELS;

export const APPOINTMENT_STATUS_LABELS = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  superseded: "Yeniden planlandı",
} as const;
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS_LABELS;

export const CANCEL_REASON_LABELS = {
  no_longer_needed: "İhtiyacım kalmadı",
  price_too_high: "Fiyat yüksek geldi",
  changed_mind: "Fikrimi değiştirdim",
  other_artisan: "Başka bir ustayla anlaştım",
  date_unsuitable: "Tarih uygun değil",
  other: "Diğer",
} as const;
export type CancelReason = keyof typeof CANCEL_REASON_LABELS;

/** Statuses that still need work; used by "open job" lists and counts. */
export const OPEN_JOB_STATUSES = ["unplanned", "scheduled", "in_progress", "waiting_material"] as const satisfies readonly JobStatus[];
