/**
 * Creates an artisan account: auth user (email confirmed) + profiles row.
 * Prints a generated temporary password once. If the profile insert fails,
 * the auth user is deleted again, so no half-created account remains.
 *
 *   npm run admin:create-artisan -- --email usta@ornek.com --name "Ahmet Usta"
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSchema, fail, findUserByEmail, generateTemporaryPassword } from "./admin-shared";

async function main() {
  const args = z
    .object({
      email: emailSchema,
      name: z.string().trim().min(1).max(80),
    })
    .safeParse(parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } }).values);
  if (!args.success) fail('Usage: --email <address> --name "<display name, 1-80 chars>"');
  const { email, name } = args.data;

  const admin = createAdminClient();
  if (await findUserByEmail(admin, email)) fail(`A user with ${email} already exists.`);

  const password = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) fail(`Could not create the auth user: ${createError?.message}`);
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({ id: userId, display_name: name });
  if (profileError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(userId);
    fail(
      rollbackError
        ? `Profile insert failed (${profileError.message}) AND rollback failed (${rollbackError.message}). Delete user ${userId} in the dashboard.`
        : `Profile insert failed (${profileError.message}); the auth user was removed again.`,
    );
  }

  console.log(`Created artisan ${email} (${userId}).`);
  console.log(`Temporary password (shown once, share it privately): ${password}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
