"use server";

import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { ADMIN_HOME, hasAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { ok: false; error: string; email: string } | null;

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = signInSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: "E-posta adresini ve şifreni kontrol et.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "E-posta veya şifre hatalı."
        : "Şu an giriş yapılamıyor. Biraz sonra tekrar dene.";
    return { ok: false, error: message, email };
  }

  redirect(hasAdminRole(data.user.app_metadata) ? ADMIN_HOME : "/bugun", RedirectType.replace);
}

export async function signOut(formData?: FormData) {
  const supabase = await createClient();
  // This device stops receiving this artisan's pushes (DATA_MODEL §2): its
  // subscription row goes before the session does (RLS: own rows only).
  const endpoint = formData?.get("pushEndpoint");
  if (typeof endpoint === "string" && endpoint.startsWith("https://")) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
  // Only this device; other devices stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/giris", RedirectType.replace);
}
