import "server-only";
import { randomBytes } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Artisan account operations with the secret-key client, shared by the admin
 * panel (after requireAdmin) and the local scripts. They never log or store
 * the temporary passwords they return.
 */
type Admin = ReturnType<typeof createAdminClient>;

/** Effectively permanent; lifted with "none" (plan A-3). */
const BAN_DURATION = "876000h";

/** 18 random characters (base64url): shown once, never stored. */
export function generateTemporaryPassword() {
  return randomBytes(14).toString("base64url").slice(0, 18);
}

export function isBanned(user: Pick<User, "banned_until">, now = new Date()) {
  return Boolean(user.banned_until && new Date(user.banned_until).getTime() > now.getTime());
}

export async function listAllUsers(admin: Admin) {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

export async function findUserByEmail(admin: Admin, email: string) {
  return (await listAllUsers(admin)).find((user) => user.email?.toLowerCase() === email) ?? null;
}

export type AccountResult<T> = { ok: true; data: T } | { ok: false; error: string; code: "exists" | "not_found" | "failed" };

/** Auth user (email confirmed) + profiles row; the auth user is removed again if the profile insert fails. */
export async function createArtisanAccount(admin: Admin, email: string, displayName: string): Promise<AccountResult<{ userId: string; password: string }>> {
  if (await findUserByEmail(admin, email)) return { ok: false, code: "exists", error: `A user with ${email} already exists.` };

  const password = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) return { ok: false, code: "failed", error: `Could not create the auth user: ${createError?.message}` };
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({ id: userId, display_name: displayName });
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      code: "failed",
      error: rollbackError
        ? `Profile insert failed (${profileError.message}) AND rollback failed (${rollbackError.message}). Delete user ${userId} in the dashboard.`
        : `Profile insert failed (${profileError.message}); the auth user was removed again.`,
    };
  }
  return { ok: true, data: { userId, password } };
}

/** Only artisans (users with a profile) are managed here, never the admin account. */
async function artisanExists(admin: Admin, userId: string) {
  const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  return Boolean(data);
}

export async function resetArtisanPassword(admin: Admin, userId: string): Promise<AccountResult<{ password: string }>> {
  if (!(await artisanExists(admin, userId))) return { ok: false, code: "not_found", error: "No artisan with this id." };
  const password = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false, code: "failed", error: `Could not reset the password: ${error.message}` };
  return { ok: true, data: { password } };
}

/**
 * Deactivate: auth ban (no sign-in, no session refresh) and the artisan's
 * push subscriptions are deleted, so their devices get nothing. Data and
 * customer links stay as they are. Reactivate lifts the ban; notifications
 * are turned on again per device.
 */
export async function setArtisanActive(admin: Admin, userId: string, active: boolean): Promise<AccountResult<null>> {
  if (!(await artisanExists(admin, userId))) return { ok: false, code: "not_found", error: "No artisan with this id." };
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : BAN_DURATION });
  if (error) return { ok: false, code: "failed", error: `Could not update the account: ${error.message}` };
  if (!active) {
    const { error: pushError } = await admin.from("push_subscriptions").delete().eq("owner_user_id", userId);
    if (pushError) return { ok: false, code: "failed", error: `Account banned, but push subscriptions were not removed: ${pushError.message}` };
  }
  return { ok: true, data: null };
}
