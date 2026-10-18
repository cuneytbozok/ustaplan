"use server";

import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { ADMIN_HOME, getAdminGate, NOT_ALLOWED } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type TotpEnrollment = { factorId: string; qrCode: string; secret: string };
export type TotpVerifyState = { ok: false; error: string } | null;

/**
 * Starts TOTP enrollment for an admin who has no verified factor yet. Earlier
 * unfinished enrollments are removed first, so reloading never piles up
 * unverified factors.
 */
export async function startTotpEnrollment(): Promise<ActionResult<TotpEnrollment>> {
  const gate = await getAdminGate();
  if (gate.kind !== "mfa-enroll") return { ok: false, error: NOT_ALLOWED };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `UstaPlan Yönetim ${Date.now()}`,
    issuer: "UstaPlan",
  });
  if (error || !data) return { ok: false, error: "Doğrulama uygulaması kaydı başlatılamadı. Tekrar dene." };
  return { ok: true, data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

const codeSchema = z.string().trim().regex(/^\d{6}$/);

/**
 * Verifies a 6-digit code: the new factor during enrollment, otherwise the
 * admin's verified factor. Success upgrades the session cookie to aal2.
 */
export async function verifyTotp(_previous: TotpVerifyState, formData: FormData): Promise<TotpVerifyState> {
  const gate = await getAdminGate();
  if (gate.kind === "ok") redirect(ADMIN_HOME, RedirectType.replace);
  if (gate.kind === "none") return { ok: false, error: NOT_ALLOWED };

  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { ok: false, error: "Uygulamadaki 6 haneli kodu gir." };

  const supabase = await createClient();
  let factorId: string | undefined;
  if (gate.kind === "mfa-verify") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    factorId = factors?.totp[0]?.id;
  } else {
    const requested = z.uuid().safeParse(formData.get("factorId"));
    factorId = requested.success ? requested.data : undefined;
  }
  if (!factorId) return { ok: false, error: "Doğrulama bulunamadı. Sayfayı yenileyip tekrar dene." };

  // The factor must belong to this user: Supabase refuses anyone else's id.
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { ok: false, error: "Kod hatalı ya da süresi geçmiş. Yeni kodu gir." };

  redirect(ADMIN_HOME, RedirectType.replace);
}
