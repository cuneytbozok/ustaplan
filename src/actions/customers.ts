"use server";

import { redirect, RedirectType } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { actionContext, SESSION_EXPIRED } from "@/lib/auth-action";
import { normalizePhone } from "@/lib/domain/phone";

export type CustomerFormValues = { name: string; phone: string; privateNote: string };
export type CustomerFormState = (ActionResult & { values: CustomerFormValues }) | null;

const id = z.uuid();

const customerSchema = z.object({
  name: z.string().trim().min(1, "Müşterinin adını yaz.").max(160, "En fazla 160 karakter olabilir."),
  phone: z.string().trim().max(30, "Telefon numarası geçersiz."),
  privateNote: z.string().trim().max(2000, "Not en fazla 2000 karakter olabilir."),
});

function readCustomer(formData: FormData): CustomerFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    privateNote: String(formData.get("privateNote") ?? ""),
  };
}

function parseCustomer(values: CustomerFormValues) {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return { error: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) };
  }
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { error: { phone: "Telefon numarası geçersiz. Örnek: 0532 123 45 67" } };
  return { row: { name: parsed.data.name, phone, private_note: parsed.data.privateNote || null } };
}

export async function createCustomer(_previous: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const values = readCustomer(formData);
  const parsed = parseCustomer(values);
  if (parsed.error) return { ok: false, error: "Bilgileri kontrol et.", fieldErrors: parsed.error, values };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED, values };

  const { data, error } = await supabase.from("customers").insert(parsed.row).select("id").single();
  if (error || !data) return { ok: false, error: "Müşteri kaydedilemedi. Tekrar dene.", values };
  redirect(`/musteriler/${data.id}`, RedirectType.replace);
}

export async function updateCustomer(
  customerId: string,
  _previous: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const values = readCustomer(formData);
  if (!id.safeParse(customerId).success) return { ok: false, error: "Müşteri bulunamadı.", values };
  const parsed = parseCustomer(values);
  if (parsed.error) return { ok: false, error: "Bilgileri kontrol et.", fieldErrors: parsed.error, values };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED, values };

  const { data, error } = await supabase.from("customers").update(parsed.row).eq("id", customerId).select("id");
  if (error) return { ok: false, error: "Kaydedilemedi. Tekrar dene.", values };
  if (!data?.length) return { ok: false, error: "Müşteri bulunamadı.", values };
  // The form returns to the page it came from (no extra history entry).
  refresh();
  return { ok: true, data: undefined, values };
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  if (!id.safeParse(customerId).success) return { ok: false, error: "Müşteri bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.from("customers").delete().eq("id", customerId).select("id");
  if (error?.code === "23503") {
    return { ok: false, error: "Bu müşterinin işleri var. İşleri olan müşteri silinemez." };
  }
  if (error) return { ok: false, error: "Silinemedi. Tekrar dene." };
  if (!data?.length) return { ok: false, error: "Müşteri bulunamadı." };
  redirect("/musteriler", RedirectType.replace);
}

// --- Addresses -------------------------------------------------------------

export type AddressFormValues = { label: string; addressText: string };
export type AddressFormState = (ActionResult & { values: AddressFormValues }) | null;

const addressSchema = z.object({
  label: z.string().trim().max(40, "Etiket en fazla 40 karakter olabilir."),
  addressText: z.string().trim().min(1, "Adresi yaz.").max(500, "Adres en fazla 500 karakter olabilir."),
});

function readAddress(formData: FormData): AddressFormValues {
  return { label: String(formData.get("label") ?? ""), addressText: String(formData.get("addressText") ?? "") };
}

function addressErrors(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

export async function createAddress(
  customerId: string,
  _previous: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const values = readAddress(formData);
  if (!id.safeParse(customerId).success) return { ok: false, error: "Müşteri bulunamadı.", values };
  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Adresi kontrol et.", fieldErrors: addressErrors(parsed.error), values };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED, values };

  // The composite FK (owner_user_id, customer_id) rejects another artisan's customer.
  const { error } = await supabase.from("customer_addresses").insert({
    customer_id: customerId,
    label: parsed.data.label || null,
    address_text: parsed.data.addressText,
  });
  if (error) return { ok: false, error: "Adres kaydedilemedi. Tekrar dene.", values };
  refresh();
  return { ok: true, data: undefined, values: { label: "", addressText: "" } };
}

export async function updateAddress(
  addressId: string,
  _previous: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const values = readAddress(formData);
  if (!id.safeParse(addressId).success) return { ok: false, error: "Adres bulunamadı.", values };
  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Adresi kontrol et.", fieldErrors: addressErrors(parsed.error), values };

  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED, values };

  const { data, error } = await supabase
    .from("customer_addresses")
    .update({ label: parsed.data.label || null, address_text: parsed.data.addressText })
    .eq("id", addressId)
    .select("id");
  if (error) return { ok: false, error: "Adres kaydedilemedi. Tekrar dene.", values };
  if (!data?.length) return { ok: false, error: "Adres bulunamadı.", values };
  refresh();
  return { ok: true, data: undefined, values };
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  if (!id.safeParse(addressId).success) return { ok: false, error: "Adres bulunamadı." };
  const { supabase, userId } = await actionContext();
  if (!userId) return { ok: false, error: SESSION_EXPIRED };

  const { data, error } = await supabase.from("customer_addresses").delete().eq("id", addressId).select("id");
  if (error) return { ok: false, error: "Adres silinemedi. Tekrar dene." };
  if (!data?.length) return { ok: false, error: "Adres bulunamadı." };
  refresh();
  return { ok: true, data: undefined };
}
