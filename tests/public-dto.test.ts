import { describe, expect, it } from "vitest";
import { toCustomerJobView, type CustomerJobSource } from "@/lib/public-job";

// A source row stuffed with everything that must never reach a customer.
const source = (overrides: Partial<CustomerJobSource["job"]> = {}): CustomerJobSource =>
  ({
    token: "TOKEN",
    profile: { display_name: "Ahmet Usta", business_name: "Ahmet Tesisat", contact_phone: "+905551112233", id: "owner-id" },
    job: {
      title: "Kombi bakımı",
      status: "scheduled",
      agreed_price: 2500,
      show_price_to_customer: true,
      estimated_price: 1999,
      private_note: "GİZLİ NOT",
      cancelled_note: "GİZLİ İPTAL",
      customer_id: "customer-id",
      address_id: "address-id",
      share_version: 7,
      ...overrides,
    },
    customer: { name: "Müşteri Adı", phone: "+905329998877", address_text: "Gizli Sokak No: 1" },
    upcoming: [
      { starts_at: "2026-10-21T10:00:00Z", ends_at: "2026-10-21T11:00:00Z" },
      { starts_at: "2026-10-20T07:00:00Z", ends_at: "2026-10-20T08:00:00Z", private_note: "RANDEVU NOTU" },
    ],
    media: [
      { id: "shared-photo", kind: "image", origin: "artisan", visibility: "shared", storage_path: "owner/job/a.jpg" },
      { id: "private-photo", kind: "image", origin: "artisan", visibility: "private", storage_path: "owner/job/b.jpg" },
      { id: "customer-photo", kind: "image", origin: "customer", visibility: "shared", storage_path: "owner/job/c.jpg" },
      { id: "voice-note", kind: "audio", origin: "artisan", visibility: "private", storage_path: "owner/job/d.m4a" },
    ],
  }) as unknown as CustomerJobSource;

const keys = (value: object) => Object.keys(value).sort();

describe("CustomerJobView allowlist", () => {
  const view = toCustomerJobView(source());
  const json = JSON.stringify(view);

  it("has exactly the allowlisted keys", () => {
    expect(keys(view)).toEqual(["agreedPrice", "artisan", "capabilities", "job", "nextAppointment", "photos"]);
    expect(keys(view.artisan)).toEqual(["name", "phone"]);
    expect(keys(view.job)).toEqual(["status", "title"]);
    expect(keys(view.nextAppointment!)).toEqual(["endsAt", "startsAt"]);
    expect(keys(view.capabilities)).toEqual(["cancel", "requestReschedule", "uploadPhotos"]);
    for (const photo of view.photos) expect(keys(photo)).toEqual(["canDelete", "fromCustomer", "id", "url"]);
  });

  it("never contains the estimate, notes, customer phone/address or storage paths", () => {
    for (const secret of ["1999", "GİZLİ", "RANDEVU NOTU", "+905329998877", "Gizli Sokak", "Müşteri Adı", "customer-id", "address-id", "owner/job", "owner-id", "\"7\""]) {
      expect(json).not.toContain(secret);
    }
  });

  it("shows only shared artisan photos and customer photos, never private ones or audio", () => {
    expect(view.photos.map((p) => p.id)).toEqual(["shared-photo", "customer-photo"]);
    expect(view.photos.every((p) => p.url.startsWith("/api/t/TOKEN/media/"))).toBe(true);
    expect(view.photos.find((p) => p.id === "customer-photo")?.canDelete).toBe(true);
    expect(view.photos.find((p) => p.id === "shared-photo")?.canDelete).toBe(false);
  });

  it("shows the agreed price only when the artisan shares it", () => {
    expect(view.agreedPrice).toBe(2500);
    expect(toCustomerJobView(source({ show_price_to_customer: false })).agreedPrice).toBeNull();
  });

  it("uses the earliest upcoming visit and the artisan's business name and phone", () => {
    expect(view.nextAppointment).toEqual({ startsAt: "2026-10-20T07:00:00Z", endsAt: "2026-10-20T08:00:00Z" });
    expect(view.artisan).toEqual({ name: "Ahmet Tesisat", phone: "+905551112233" });
  });

  it("derives capabilities from the job state (plan §5)", () => {
    const caps = (status: string, upcoming = true) =>
      toCustomerJobView({ ...source({ status }), upcoming: upcoming ? source().upcoming : [] }).capabilities;
    expect(caps("unplanned", false)).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: true });
    expect(caps("scheduled")).toEqual({ uploadPhotos: true, requestReschedule: true, cancel: true });
    expect(caps("in_progress", false)).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: true });
    expect(caps("completed")).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: false });
    expect(caps("cancelled")).toEqual({ uploadPhotos: false, requestReschedule: false, cancel: false });
  });
});
