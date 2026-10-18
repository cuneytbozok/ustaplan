import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ADMIN_HOME, hasAdminRole } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type CurrentArtisan = { id: string; email: string; displayName: string };

/**
 * Data access layer entry point: verifies the session on the server
 * (getClaims, never getSession) and returns a narrow artisan object.
 * Redirects to /giris without a valid session. A missing profile is an admin
 * error (create-artisan always writes one), so it throws instead of looping;
 * the admin account has no profile by design and is sent to its panel.
 * Deduplicated per request with React cache().
 */
export const getCurrentArtisan = cache(async (): Promise<CurrentArtisan> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/giris");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  if (!profile) {
    if (hasAdminRole(claimsData.claims.app_metadata)) redirect(ADMIN_HOME);
    throw new Error("Usta profili bulunamadı.");
  }

  return { id: userId, email: String(claimsData.claims.email ?? ""), displayName: profile.display_name };
});
