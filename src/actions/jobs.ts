"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";
import { parseTurkishPrice } from "@/lib/domain/money";
import { normalizePhone } from "@/lib/domain/phone";

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
  if (Object.keys(errors).length) return fail("Bilgileri kontrol et.", errors);

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
  });
  if (error) {
    return error.code === "23503" ? fail("Seçilen adres bu müşteriye ait değil.") : fail("İş kaydedilemedi. Tekrar dene.");
  }

  const result = data as { result: string; customer_id?: string };
  if (result.result === "customer_not_found") return fail("Müşteri bulunamadı.", { customer: "Müşteri bulunamadı." });
  if (result.result !== "ok" || !result.customer_id) return fail("Bilgileri kontrol et.");

  // The job detail page arrives in M2.4; until then the customer page lists the new job.
  redirect(`/musteriler/${result.customer_id}`);
}
