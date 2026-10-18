import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_HOME = "/admin";
export const ADMIN_MFA_PATH = "/admin/mfa";

/** `app_metadata` is writable only with the secret key, so a user can't grant this to themselves. */
export function hasAdminRole(appMetadata: unknown) {
  return (appMetadata as { role?: unknown } | undefined)?.role === "admin";
}

export type AdminGate =
  | { kind: "ok"; userId: string; email: string }
  | { kind: "mfa-enroll" | "mfa-verify"; userId: string }
  | { kind: "none" };

/**
 * Admin panel gate (plan §4.1): server-verified session (getClaims) → admin
 * role → TOTP-verified session (aal2). A role holder at aal1 still has to
 * enrol or enter a code. Deduplicated per request.
 */
export const getAdminGate = cache(async (): Promise<AdminGate> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !hasAdminRole(claims.app_metadata)) return { kind: "none" };
  if (claims.aal === "aal2") return { kind: "ok", userId: claims.sub, email: String(claims.email ?? "") };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  // `totp` lists verified factors only.
  return { kind: factors?.totp.length ? "mfa-verify" : "mfa-enroll", userId: claims.sub };
});

/** Pages: anyone without the role gets a plain 404; a role holder without aal2 goes to the code page. */
export async function requireAdmin() {
  const gate = await getAdminGate();
  if (gate.kind === "none") notFound();
  if (gate.kind !== "ok") redirect(ADMIN_MFA_PATH);
  return gate;
}

export const NOT_ALLOWED = "Bu işlem için yetkin yok.";
