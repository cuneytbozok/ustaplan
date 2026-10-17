"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";
import { parseTurkishPrice } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";
import { readAppointmentFields } from "@/lib/domain/scheduling";

export type NewJobValues = {
  jobId: string;
  customerMode: "existing" | "new";
  customerId: string;
  newCustomerName: string;
  newCustomerPhone: string;
  title: string;
  addressId: string;
  agreedPrice: string;
  estimatedPrice: string;
  showPrice: boolean;
  privateNote: string;
};
export type NewJobState = (Extract<ActionResult, { ok: false }> & { values: NewJobValues }) | null;

const schema = z.object({
  jobId: z.uuid(),
  customerMode: z.enum(["existing", "new"]),
  customerId: z.string(),
  newCustomerName: z.string().trim().max(160, "En fazla 160 karakter olabilir."),
  newCustomerPhone: z.string().trim().max(30),
  title: z.string().trim().min(1, "Yapılacak işi yaz.").max(200, "En fazla 200 karakter olabilir."),
  addressId: z.string(),
  agreedPrice: z.string().trim(),
  estimatedPrice: z.string().trim(),
  showPrice: z.boolean(),
  privateNote: z.string().trim().max(4000, "Not en fazla 4000 karakter olabilir."),
});

function read(formData: FormData): NewJobValues {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    jobId: text("jobId"),
    customerMode: text("customerMode") === "new" ? "new" : "existing",
    customerId: text("customerId"),
    newCustomerName: text("newCustomerName"),
    newCustomerPhone: text("newCustomerPhone"),
    title: text("title"),
    addressId: text("addressId"),
    agreedPrice: text("agreedPrice"),
    estimatedPrice: text("estimatedPrice"),
    showPrice: formData.get("showPrice") === "on",
    privateNote: text("privateNote"),
  };
}

const isUuid = (value: string) => z.uuid().safeParse(value).success;

export async function createJob(_previous: NewJobState, formData: FormData): Promise<NewJobState> {
  const values = read(formData);
  const fail = (error: string, fieldErrors?: Record<string, string>): NewJobState => ({ ok: false, error, fieldErrors, values });

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return fail("Bilgileri kontrol et.", Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
  }
  const input = parsed.data;
  const errors: Record<string, string> = {};

  if (input.customerMode === "existing" && !isUuid(input.customerId)) errors.customer = "Bir müşteri seç.";
  if (input.customerMode === "new" && !input.newCustomerName) errors.newCustomerName = "Müşterinin adını yaz.";
  const phone = input.customerMode === "new" && input.newCustomerPhone ? normalizePhone(input.newCustomerPhone) : null;
  if (input.customerMode === "new" && input.newCustomerPhone && !phone) errors.newCustomerPhone = "Telefon numarası geçersiz. Örnek: 0532 123 45 67";

  const agreed = input.agreedPrice ? parseTurkishPrice(input.agreedPrice) : null;
  if (input.agreedPrice && agreed === null) errors.agreedPrice = "Fiyatı 2.500 veya 2.500,50 gibi yaz.";
  const estimated = input.estimatedPrice ? parseTurkishPrice(input.estimatedPrice) : null;
  if (input.estimatedPrice && estimated === null) errors.estimatedPrice = "Fiyatı 2.500 veya 2.500,50 gibi yaz.";
  // The estimate is never public: showing a price needs an agreed price.
  if (input.showPrice && agreed === null && !errors.agreedPrice) errors.agreedPrice = "Müşteriye göstermek için anlaşılan fiyatı yaz.";

  const addressId = input.customerMode === "existing" && isUuid(input.addressId) ? input.addressId : null;
  // "Randevu planla" is optional; when on, the first visit is created in the same transaction.
  const appointment = formData.get("schedule") === "on" ? readAppointmentFields(formData) : null;
  if (appointment && "error" in appointment) errors.appointment = appointment.error;
  if (Object.keys(errors).length) return fail("Bilgileri kontrol et.", errors);
  const slot = appointment && !("error" in appointment) ? appointment : null;

  const { supabase, userId } = await actionContext();
  if (!userId) return fail(SESSION_EXPIRED);

  const { data, error } = await supabase.rpc("create_job", {
    p_job_id: input.jobId,
    p_title: input.title,
    p_customer_id: input.customerMode === "existing" ? input.customerId : undefined,
    p_new_customer_name: input.customerMode === "new" ? input.newCustomerName : undefined,
    p_new_customer_phone: phone ?? undefined,
    p_address_id: addressId ?? undefined,
    p_private_note: input.privateNote || undefined,
    p_estimated_price: estimated ?? undefined,
    p_agreed_price: agreed ?? undefined,
    p_show_price: input.showPrice,
    p_starts_at: slot?.start.toISOString(),
    p_ends_at: slot?.end.toISOString(),
  });
  if (error) {
    return error.code === "23503" ? fail("Seçilen adres bu müşteriye ait değil.") : fail("İş kaydedilemedi. Tekrar dene.");
  }

  const result = data as { result: string; job_id?: string };
  if (result.result === "customer_not_found") return fail("Müşteri bulunamadı.", { customer: "Müşteri bulunamadı." });
  if (result.result !== "ok" || !result.job_id) return fail("Bilgileri kontrol et.");

  redirect(`/isler/${result.job_id}`);
}

// --- Edit (plain RLS update; jobs_log_changes writes the history) -----------

export type EditJobValues = {
  customerId: string;
  title: string;
  addressId: string;
  agreedPrice: string;
  estimatedPrice: string;
  showPrice: boolean;
  privateNote: string;
};
export type EditJobState = (Extract<ActionResult, { ok: false }> & { values: EditJobValues }) | null;

const editSchema = schema.pick({ customerId: true, title: true, addressId: true, agreedPrice: true, estimatedPrice: true, showPrice: true, privateNote: true });

export async function updateJob(jobId: string, _previous: EditJobState, formData: FormData): Promise<EditJobState> {
  const text = (key: string) => String(formData.get(key) ?? "");
  const values: EditJobValues = {
    customerId: text("customerId"),
    title: text("title"),
    addressId: text("addressId"),
    agreedPrice: text("agreedPrice"),
    estimatedPrice: text("estimatedPrice"),
    showPrice: formData.get("showPrice") === "on",
    privateNote: text("privateNote"),
  };
  const fail = (error: string, fieldErrors?: Record<string, string>): EditJobState => ({ ok: false, error, fieldErrors, values });
  if (!isUuid(jobId)) return fail("İş bulunamadı.");

  const parsed = editSchema.safeParse(values);
  if (!parsed.success) {
    return fail("Bilgileri kontrol et.", Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
  }
  const input = parsed.data;
  const errors: Record<string, string> = {};
  if (!isUuid(input.customerId)) errors.customer = "Bir müşteri seç.";
  const agreed = input.agreedPrice ? parseTurkishPrice(input.agreedPrice) : null;
  if (input.agreedPrice && agreed === null) errors.agreedPrice = "Fiyatı 2.500 veya 2.500,50 gibi yaz.";
  const estimated = input.estimatedPrice ? parseTurkishPrice(input.estimatedPrice) : null;
  if (input.estimatedPrice && estimated === null) errors.estimatedPrice = "Fiyatı 2.500 veya 2.500,50 gibi yaz.";
  if (input.showPrice && agreed === null && !errors.agreedPrice) errors.agreedPrice = "Müşteriye göstermek için anlaşılan fiyatı yaz.";
  if (Object.keys(errors).length) return fail("Bilgileri kontrol et.", errors);

  const { supabase, userId } = await actionContext();
  if (!userId) return fail(SESSION_EXPIRED);

  // The composite FKs reject another artisan's customer and an address of a different customer.
  const { data, error } = await supabase
    .from("jobs")
    .update({
      customer_id: input.customerId,
      address_id: isUuid(input.addressId) ? input.addressId : null,
      title: input.title,
      agreed_price: agreed,
      estimated_price: estimated,
      show_price_to_customer: input.showPrice,
      private_note: input.privateNote || null,
    })
    .eq("id", jobId)
    .select("id");
  if (error) return error.code === "23503" ? fail("Seçilen müşteri veya adres geçersiz.") : fail("Kaydedilemedi. Tekrar dene.");
  if (!data?.length) return fail("İş bulunamadı.");
  redirect(`/isler/${jobId}`);
}

// --- Status (change_job_status RPC: J1, J4, J5, J6) ------------------------

export type StatusAction = "start" | "wait_material" | "complete" | "cancel" | "reopen";
const statusSchema = z.object({
  jobId: z.uuid(),
  action: z.enum(["start", "wait_material", "complete", "cancel", "reopen"]),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir."),
});

export async function changeJobStatus(jobId: string, action: StatusAction, note = ""): Promise<ActionResult> {
  const parsed = statusSchema.safeParse({ jobId, action, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Bilgileri kontrol et." };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.rpc("change_job_status", {
    p_job_id: parsed.data.jobId,
    p_action: parsed.data.action,
    p_note: parsed.data.action === "cancel" && parsed.data.note ? parsed.data.note : undefined,
  });
  if (error) return { ok: false, error: "Durum değiştirilemedi. Tekrar dene." };
  const result = (data as { result: string }).result;
  if (result === "not_found") return { ok: false, error: "İş bulunamadı." };
  if (result === "invalid_transition") return { ok: false, error: "İşin durumu değişmiş. Sayfayı yenileyip tekrar dene." };
  if (result !== "ok") return { ok: false, error: "Bilgileri kontrol et." };
  refresh();
  return { ok: true, data: undefined };
}
