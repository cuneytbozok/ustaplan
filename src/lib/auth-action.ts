import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Start of every artisan Server Action: user-scoped client plus the
 * server-verified user id (getClaims). userId is null without a session.
 */
export async function actionContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export const SESSION_EXPIRED = "Oturumun sona ermiş. Tekrar giriş yap.";
