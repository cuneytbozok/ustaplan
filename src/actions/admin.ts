"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { createArtisanAccount, resetArtisanPassword as resetPassword, setArtisanActive as setActive } from "@/lib/admin/accounts";
import { getAdminGate, NOT_ALLOWED } from "@/lib/admin/auth";
import { SITE_SETTINGS_TAG } from "@/lib/site-settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin panel actions (plan §4.1). Each one checks the full gate (role +
 * aal2) itself before touching the secret-key client. Temporary passwords go
 * back to the admin's screen once and are never logged.
 */
async function allowed() {
  return (await getAdminGate()).kind === "ok";
}

const userIdSchema = z.uuid();

export type CreateArtisanState =
  | { ok: true; data: { userId: string; email: string; password: string } }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; values?: { email: string; name: string } }
  | null;

const createSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi gir.").transform((value) => value.trim().toLowerCase()),
  name: z.string().trim().min(1, "Adı gir.").max(80, "En fazla 80 karakter."),
});

export async function createArtisan(_previous: CreateArtisanState, formData: FormData): Promise<CreateArtisanState> {
  if (!(await allowed())) return { ok: false, error: NOT_ALLOWED };
  const values = { email: String(formData.get("email") ?? "").trim(), name: String(formData.get("name") ?? "") };
  const parsed = createSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
    return { ok: false, error: "Alanları kontrol et.", fieldErrors, values };
  }

  const result = await createArtisanAccount(createAdminClient(), parsed.data.email, parsed.data.name);
  if (!result.ok) {
    return result.code === "exists"
      ? { ok: false, error: "Bu e-posta ile bir hesap zaten var.", fieldErrors: { email: "Bu e-posta ile bir hesap zaten var." }, values }
      : { ok: false, error: "Hesap oluşturulamadı. Tekrar dene.", values };
  }
  refresh();
  return { ok: true, data: { userId: result.data.userId, email: parsed.data.email, password: result.data.password } };
}

export async function resetArtisanPassword(userId: string): Promise<ActionResult<{ password: string }>> {
  if (!(await allowed())) return { ok: false, error: NOT_ALLOWED };
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Usta bulunamadı." };
  const result = await resetPassword(createAdminClient(), id.data);
  if (!result.ok) return { ok: false, error: result.code === "not_found" ? "Usta bulunamadı." : "Şifre sıfırlanamadı. Tekrar dene." };
  return { ok: true, data: { password: result.data.password } };
}

export async function setArtisanActive(userId: string, active: boolean): Promise<ActionResult> {
  if (!(await allowed())) return { ok: false, error: NOT_ALLOWED };
  const input = z.object({ id: userIdSchema, active: z.boolean() }).safeParse({ id: userId, active });
  if (!input.success) return { ok: false, error: "Usta bulunamadı." };
  const result = await setActive(createAdminClient(), input.data.id, input.data.active);
  if (!result.ok) return { ok: false, error: result.code === "not_found" ? "Usta bulunamadı." : "Hesap güncellenemedi. Tekrar dene." };
  refresh();
  return { ok: true, data: undefined };
}

/** Search-engine visibility of the landing page (plan L-2); expires the cached setting at once. */
export async function setSearchVisibility(visible: boolean): Promise<ActionResult> {
  const gate = await getAdminGate();
  if (gate.kind !== "ok") return { ok: false, error: NOT_ALLOWED };
  const input = z.boolean().safeParse(visible);
  if (!input.success) return { ok: false, error: "Geçersiz değer." };
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: "search_visibility", value: { visible: input.data }, updated_by: gate.userId });
  if (error) return { ok: false, error: "Ayar kaydedilemedi. Tekrar dene." };
  updateTag(SITE_SETTINGS_TAG);
  refresh();
  return { ok: true, data: undefined };
}
