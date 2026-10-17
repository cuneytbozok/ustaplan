"use server";

import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "E-posta veya şifre hatalı."
        : "Şu an giriş yapılamıyor. Biraz sonra tekrar dene.";
    return { ok: false, error: message, email };
  }

  redirect("/bugun", RedirectType.replace);
}

export async function signOut() {
  const supabase = await createClient();
  // Only this device; other devices stay signed in. Push subscriptions are
  // removed here too once they exist (M5.6).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/giris", RedirectType.replace);
}
