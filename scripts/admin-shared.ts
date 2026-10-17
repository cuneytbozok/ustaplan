import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

/** 18 random characters (base64url): shown once, never stored by the script. */
export function generateTemporaryPassword() {
  return randomBytes(14).toString("base64url").slice(0, 18);
}

export async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

export function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}
