/**
 * Creates the single admin account for /admin (plan §4.1, A-2): an auth user
 * with app_metadata.role = "admin" and no profiles row. Prints a generated
 * temporary password once. TOTP is enrolled on the first /admin sign-in.
 *
 *   npm run admin:create-admin -- --email sahip@ornek.com
 *   npm run admin:create-admin -- --email sahip@ornek.com --reset-mfa   (lost authenticator)
 *
 * Refuses an artisan's email (artisans have a profile) and a second admin.
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { listAllUsers } from "@/lib/admin/accounts";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSchema, fail, findUserByEmail, generateTemporaryPassword } from "./admin-shared";

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, "reset-mfa": { type: "boolean" } } });
  const args = z.object({ email: emailSchema }).safeParse(values);
  if (!args.success) fail("Usage: --email <address> [--reset-mfa]");
  const { email } = args.data;

  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, email);

  if (values["reset-mfa"]) {
    if (!existing || existing.app_metadata?.role !== "admin") fail(`${email} is not the admin account.`);
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: existing.id });
    if (error) fail(`Could not list factors: ${error.message}`);
    for (const factor of data.factors) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: existing.id });
      if (deleteError) fail(`Could not delete a factor: ${deleteError.message}`);
    }
    console.log(`Removed ${data.factors.length} factor(s). The next /admin sign-in sets up a new authenticator.`);
    return;
  }

  const other = (await listAllUsers(admin)).find((user) => user.app_metadata?.role === "admin" && user.id !== existing?.id);
  if (other) fail("Another admin account already exists. There is exactly one admin.");

  if (existing) {
    const { data: profile } = await admin.from("profiles").select("id").eq("id", existing.id).maybeSingle();
    if (profile) fail(`${email} is an artisan account. Use a separate email for the admin.`);
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: "admin" },
    });
    if (error) fail(`Could not set the admin role: ${error.message}`);
    console.log(`${email} (${existing.id}) is now the admin. Password unchanged.`);
    return;
  }

  const password = generateTemporaryPassword();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (error || !created.user) fail(`Could not create the admin: ${error?.message}`);

  console.log(`Created admin ${email} (${created.user.id}).`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log("Sign in at /giris; /admin then asks you to set up an authenticator app.");
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
