// CustomerJobView (plan §5): the ONLY shape the customer page and its API may
// return. Built field by field from allowlisted inputs; never spread a row.
// It never contains the customer's phone or address, other jobs, notes,
// audio, private photos, the estimated price or the artisan's calendar.

import { OPEN_JOB_STATUSES, type JobStatus } from "./domain/labels";

export type CustomerJobView = {
  artisan: { name: string; phone: string | null };
  job: { title: string; status: JobStatus };
  nextAppointment: { startsAt: string; endsAt: string } | null;
  agreedPrice: number | null;
  photos: { id: string; url: string; fromCustomer: boolean; canDelete: boolean }[];
  capabilities: { uploadPhotos: boolean; requestReschedule: boolean; cancel: boolean };
};

/** Raw inputs the loader fetched; extra fields are ignored on purpose. */
export type CustomerJobSource = {
  token: string;
  profile: { display_name: string; business_name: string | null; contact_phone: string | null };
  job: { title: string; status: string; agreed_price: number | null; show_price_to_customer: boolean };
  /** Scheduled visits that haven't ended, any order. */
  upcoming: { starts_at: string; ends_at: string }[];
  /** Live (not deleted) image rows of the job. */
  media: { id: string; kind: string; origin: string; visibility: string }[];
};

const isOpen = (status: string) => (OPEN_JOB_STATUSES as readonly string[]).includes(status);

export function toCustomerJobView(source: CustomerJobSource): CustomerJobView {
  const status = source.job.status as JobStatus;
  const next = [...source.upcoming].sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const nextAppointment = next ? { startsAt: next.starts_at, endsAt: next.ends_at } : null;
  // Customers see artisan photos marked "shared" and their own uploads; never audio.
  const photos = source.media
    .filter((m) => m.kind === "image" && (m.origin === "customer" || m.visibility === "shared"))
    .map((m) => ({
      id: m.id,
      url: `/api/t/${source.token}/media/${m.id}`,
      fromCustomer: m.origin === "customer",
      canDelete: m.origin === "customer",
    }));

  return {
    artisan: {
      name: source.profile.business_name?.trim() || source.profile.display_name,
      phone: source.profile.contact_phone,
    },
    job: { title: source.job.title, status },
    nextAppointment,
    agreedPrice: source.job.show_price_to_customer ? source.job.agreed_price : null,
    photos,
    // Capability table (plan §5); the actions themselves arrive in M5.
    capabilities: {
      uploadPhotos: status !== "cancelled",
      requestReschedule: status !== "unplanned" && isOpen(status) && nextAppointment !== null,
      cancel: isOpen(status),
    },
  };
}
