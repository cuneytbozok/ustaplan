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

/** History (job_events) headlines; details are added by the timeline. */
export const JOB_EVENT_LABELS: Record<string, string> = {
  job_created: "İş oluşturuldu",
  job_updated: "İş güncellendi",
  status_changed: "Durum değişti",
  price_changed: "Fiyat değişti",
  price_visibility_changed: "Fiyat görünürlüğü değişti",
  appointment_scheduled: "Randevu planlandı",
  appointment_rescheduled: "Randevu yeniden planlandı",
  appointment_completed: "Ziyaret yapıldı",
  appointment_cancelled: "Randevu iptal edildi",
  request_created: "Müşteri yeni tarih istedi",
  request_countered: "Yeni tarih önerildi",
  request_accepted: "Tarih talebi kabul edildi",
  request_rejected: "Tarih talebi reddedildi",
  request_withdrawn: "Müşteri tarih talebini geri çekti",
  request_closed: "Tarih talebi kapandı",
  job_cancelled: "İş iptal edildi",
  job_reopened: "İş yeniden açıldı",
  media_added: "Medya eklendi",
  media_deleted: "Medya silindi",
  share_disabled: "Müşteri bağlantısı kapatıldı",
  share_enabled: "Müşteri bağlantısı açıldı",
  share_rotated: "Müşteri bağlantısı yenilendi",
  note_added: "Müşteri not ekledi",
  note_updated: "Müşteri notunu düzenledi",
  note_deleted: "Müşteri notunu sildi",
};

export const JOB_FIELD_LABELS: Record<string, string> = {
  title: "Yapılacak iş",
  address: "Adres",
  customer: "Müşteri",
  agreed_price: "Anlaşılan fiyat",
  estimated_price: "Tahmini fiyat",
};
