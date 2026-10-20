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
      { id: "appt-later", starts_at: "2026-10-21T10:00:00Z", ends_at: "2026-10-21T11:00:00Z" },
      { id: "appt-next", starts_at: "2026-10-20T07:00:00Z", ends_at: "2026-10-20T08:00:00Z", private_note: "RANDEVU NOTU" },
    ],
    requests: [],
    media: [
      { id: "shared-photo", kind: "image", origin: "artisan", visibility: "shared", storage_path: "owner/job/a.jpg" },
      { id: "private-photo", kind: "image", origin: "artisan", visibility: "private", storage_path: "owner/job/b.jpg" },
      { id: "customer-photo", kind: "image", origin: "customer", visibility: "shared", storage_path: "owner/job/c.jpg" },
      { id: "voice-note", kind: "audio", origin: "artisan", visibility: "private", storage_path: "owner/job/d.m4a" },
    ],
    notes: [
      { id: "artisan-note", author: "artisan", body: "USTA GİZLİ NOTU", created_at: "2026-10-19T09:00:00Z", edited_at: null, owner_user_id: "owner-id" },
      { id: "customer-old", author: "customer", body: "Kapı kodu 1234", created_at: "2026-10-19T08:00:00Z", edited_at: "2026-10-19T10:00:00Z" },
      { id: "customer-new", author: "customer", body: "Köpek var", created_at: "2026-10-19T11:00:00Z", edited_at: null },
    ],
  }) as unknown as CustomerJobSource;

const keys = (value: object) => Object.keys(value).sort();

describe("CustomerJobView allowlist", () => {
  const view = toCustomerJobView(source());
  const json = JSON.stringify(view);

  it("has exactly the allowlisted keys", () => {
    expect(keys(view)).toEqual(["agreedPrice", "artisan", "capabilities", "job", "nextAppointment", "notes", "photos", "request"]);
    expect(keys(view.artisan)).toEqual(["name", "phone"]);
    expect(keys(view.job)).toEqual(["status", "title"]);
    expect(keys(view.nextAppointment!)).toEqual(["endsAt", "startsAt"]);
    expect(keys(view.capabilities)).toEqual(["cancel", "requestReschedule", "uploadPhotos", "writeNotes"]);
    for (const photo of view.photos) expect(keys(photo)).toEqual(["canDelete", "fromCustomer", "id", "url"]);
    for (const note of view.notes) expect(keys(note)).toEqual(["body", "createdAt", "editedAt", "id"]);
  });

  it("shows only the customer's own notes, newest first, never the artisan's", () => {
    expect(view.notes.map((n) => n.id)).toEqual(["customer-new", "customer-old"]);
    expect(view.notes[1]).toEqual({ id: "customer-old", body: "Kapı kodu 1234", createdAt: "2026-10-19T08:00:00Z", editedAt: "2026-10-19T10:00:00Z" });
    expect(json).not.toContain("USTA GİZLİ NOTU");
    expect(json).not.toContain("artisan-note");
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
    expect(caps("unplanned", false)).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: true, writeNotes: true });
    expect(caps("scheduled")).toEqual({ uploadPhotos: true, requestReschedule: true, cancel: true, writeNotes: true });
    expect(caps("in_progress", false)).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: true, writeNotes: true });
    expect(caps("waiting_material", false)).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: true, writeNotes: true });
    expect(caps("completed")).toEqual({ uploadPhotos: true, requestReschedule: false, cancel: false, writeNotes: false });
    expect(caps("cancelled")).toEqual({ uploadPhotos: false, requestReschedule: false, cancel: false, writeNotes: false });
  });

  it("shows the latest request about the next appointment, with its note left out", () => {
    const request = (r: Partial<CustomerJobSource["requests"][number]> & { request_note?: string }) => ({
      id: "req",
      appointment_id: "appt-next",
      status: "pending_artisan",
      requested_starts_at: "2026-10-22T09:00:00Z",
      counter_starts_at: null,
      counter_ends_at: null,
      created_at: "2026-10-18T10:00:00Z",
      ...r,
    });
    const viewWith = (requests: ReturnType<typeof request>[]) => toCustomerJobView({ ...source(), requests }).request;

    expect(viewWith([])).toBeNull();
    const pending = viewWith([request({ request_note: "NOT GİZLİ" })]);
    expect(keys(pending!)).toEqual(["counterEndsAt", "counterStartsAt", "id", "requestedStartsAt", "status"]);
    expect(JSON.stringify(pending)).not.toContain("NOT GİZLİ");
    // The newest one wins; requests about another visit are ignored.
    expect(
      viewWith([
        request({ id: "old", status: "withdrawn", created_at: "2026-10-18T09:00:00Z" }),
        request({ id: "new", status: "pending_customer", counter_starts_at: "2026-10-23T09:00:00Z", counter_ends_at: "2026-10-23T10:00:00Z" }),
        request({ id: "other", appointment_id: "appt-later", created_at: "2026-10-18T11:00:00Z" }),
      ]),
    ).toEqual({ id: "new", status: "pending_customer", requestedStartsAt: "2026-10-22T09:00:00Z", counterStartsAt: "2026-10-23T09:00:00Z", counterEndsAt: "2026-10-23T10:00:00Z" });
    expect(viewWith([request({ status: "rejected", counter_starts_at: "x" })])?.counterStartsAt).toBeNull();
    // Closed, withdrawn and accepted requests aren't shown.
    for (const status of ["closed", "withdrawn", "accepted"]) expect(viewWith([request({ status })])).toBeNull();
    // No next appointment → no request.
    expect(toCustomerJobView({ ...source(), upcoming: [], requests: [request({})] }).request).toBeNull();
  });
});
