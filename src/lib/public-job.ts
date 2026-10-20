// CustomerJobView (plan §5): the ONLY shape the customer page and its API may
// return. Built field by field from allowlisted inputs; never spread a row.
// It never contains the customer's phone or address, other jobs, the
// artisan's notes, audio, private photos, the estimated price or the
// artisan's calendar. Notes in it are the customer's own (plan N-1).

import { OPEN_JOB_STATUSES, type JobStatus } from "./domain/labels";

export type CustomerJobView = {
  artisan: { name: string; phone: string | null };
  job: { title: string; status: JobStatus };
  nextAppointment: { startsAt: string; endsAt: string } | null;
  /** The latest negotiation about the next appointment: open, or the artisan's "no". */
  request: CustomerRequest | null;
  agreedPrice: number | null;
  photos: { id: string; url: string; fromCustomer: boolean; canDelete: boolean }[];
  /** The customer's own written notes, newest first. */
  notes: { id: string; body: string; createdAt: string; editedAt: string | null }[];
  capabilities: { uploadPhotos: boolean; requestReschedule: boolean; cancel: boolean; writeNotes: boolean };
};

export type CustomerRequest = {
  id: string;
  status: "pending_artisan" | "pending_customer" | "rejected";
  requestedStartsAt: string;
  counterStartsAt: string | null;
  counterEndsAt: string | null;
};

/** Raw inputs the loader fetched; extra fields are ignored on purpose. */
export type CustomerJobSource = {
  token: string;
  profile: { display_name: string; business_name: string | null; contact_phone: string | null };
  job: { title: string; status: string; agreed_price: number | null; show_price_to_customer: boolean };
  /** Scheduled visits that haven't ended, any order. */
  upcoming: { id: string; starts_at: string; ends_at: string }[];
  /** Recent requests of the job, any order. */
  requests: {
    id: string;
    appointment_id: string;
    status: string;
    requested_starts_at: string;
    counter_starts_at: string | null;
    counter_ends_at: string | null;
    created_at: string;
  }[];
  /** Live (not deleted) image rows of the job. */
  media: { id: string; kind: string; origin: string; visibility: string }[];
  /** Notes of the job; only author 'customer' is ever shown. */
  notes: { id: string; author: string; body: string; created_at: string; edited_at: string | null }[];
};

const isOpen = (status: string) => (OPEN_JOB_STATUSES as readonly string[]).includes(status);

export function toCustomerJobView(source: CustomerJobSource): CustomerJobView {
  const status = source.job.status as JobStatus;
  const next = [...source.upcoming].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const nextAppointment = next ? { startsAt: next.starts_at, endsAt: next.ends_at } : null;
  const latest = next
    ? [...source.requests].filter((r) => r.appointment_id === next.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : undefined;
  const request: CustomerRequest | null =
    latest && ["pending_artisan", "pending_customer", "rejected"].includes(latest.status)
      ? {
          id: latest.id,
          status: latest.status as CustomerRequest["status"],
          requestedStartsAt: latest.requested_starts_at,
          counterStartsAt: latest.status === "pending_customer" ? latest.counter_starts_at : null,
          counterEndsAt: latest.status === "pending_customer" ? latest.counter_ends_at : null,
        }
      : null;
  // Customers see artisan photos marked "shared" and their own uploads; never audio.
  const photos = source.media
    .filter((m) => m.kind === "image" && (m.origin === "customer" || m.visibility === "shared"))
    .map((m) => ({
      id: m.id,
      url: `/api/t/${source.token}/media/${m.id}`,
      fromCustomer: m.origin === "customer",
      canDelete: m.origin === "customer",
    }));

  // The artisan's notes are private: only the customer's own notes are shown.
  const notes = source.notes
    .filter((n) => n.author === "customer")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at, editedAt: n.edited_at }));

  return {
    artisan: {
      name: source.profile.business_name?.trim() || source.profile.display_name,
      phone: source.profile.contact_phone,
    },
    job: { title: source.job.title, status },
    nextAppointment,
    request,
    agreedPrice: source.job.show_price_to_customer ? source.job.agreed_price : null,
    photos,
    notes,
    // Capability table (plan §5; notes: plan N-1, open jobs only).
    capabilities: {
      uploadPhotos: status !== "cancelled",
      requestReschedule: status !== "unplanned" && isOpen(status) && nextAppointment !== null,
      cancel: isOpen(status),
      writeNotes: isOpen(status),
    },
  };
}
