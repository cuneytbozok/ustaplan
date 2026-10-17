"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { normalizePhone } from "@/lib/domain/phone";
import { supabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormValues = { displayName: string; businessName: string; contactPhone: string };
export type ProfileState = (ActionResult<ProfileFormValues> & { values: ProfileFormValues }) | null;

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Adını yaz.").max(80, "En fazla 80 karakter olabilir."),
  businessName: z.string().trim().max(120, "En fazla 120 karakter olabilir."),
  contactPhone: z.string().trim().max(30, "Telefon numarası geçersiz."),
});

export async function updateProfile(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const values: ProfileFormValues = {
    displayName: String(formData.get("displayName") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
  };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    return { ok: false, error: "Bilgileri kontrol et.", fieldErrors, values };
  }

  const { displayName, businessName, contactPhone } = parsed.data;
  const phone = contactPhone ? normalizePhone(contactPhone) : null;
  if (contactPhone && !phone) {
    return { ok: false, error: "Bilgileri kontrol et.", fieldErrors: { contactPhone: "Telefon numarası geçersiz. Örnek: 0532 123 45 67" }, values };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, error: "Oturumun sona ermiş. Tekrar giriş yap.", values };

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, business_name: businessName || null, contact_phone: phone })
    .eq("id", userId)
    .select("display_name, business_name, contact_phone")
    .single();
  if (error || !saved) return { ok: false, error: "Kaydedilemedi. Tekrar dene.", values };

  refresh();
  const savedValues = {
    displayName: saved.display_name,
    businessName: saved.business_name ?? "",
    contactPhone: saved.contact_phone ?? "",
  };
  return { ok: true, data: savedValues, values: savedValues };
}

export type PasswordState = ActionResult | null;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifreni yaz."),
    newPassword: z.string().min(8, "Yeni şifre en az 8 karakter olmalı.").max(72, "Yeni şifre en fazla 72 karakter olabilir."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Şifreler aynı değil.",
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ["newPassword"],
    message: "Yeni şifre mevcut şifrenden farklı olmalı.",
  });

export async function changePassword(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    return { ok: false, error: "Şifre alanlarını kontrol et.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const email = claims?.claims?.email;
  if (!email) return { ok: false, error: "Oturumun sona ermiş. Tekrar giriş yap." };

  // Verify the current password with a throw-away client that stores nothing,
  // then end that extra session right away. The user's own session is untouched.
  const { url, publishableKey } = supabaseEnv();
  const verifier = createPlainClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: String(email),
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return verifyError.code === "invalid_credentials"
      ? { ok: false, error: "Mevcut şifren hatalı.", fieldErrors: { currentPassword: "Mevcut şifren hatalı." } }
      : { ok: false, error: "Şifre şu an değiştirilemiyor. Biraz sonra tekrar dene." };
  }
  await verifier.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    const message =
      error.code === "weak_password"
        ? "Bu şifre çok zayıf. Daha uzun ve tahmin edilmesi zor bir şifre seç."
        : error.code === "same_password"
          ? "Yeni şifre mevcut şifrenden farklı olmalı."
          : "Şifre değiştirilemedi. Tekrar dene.";
    return { ok: false, error: message };
  }

  return { ok: true, data: undefined };
}
