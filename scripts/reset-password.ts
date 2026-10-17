/**
 * Sets a new generated temporary password for an existing artisan and prints
 * it once. The artisan should change it in Ayarlar after signing in.
 *
 *   npm run admin:reset-password -- --email usta@ornek.com
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSchema, fail, findUserByEmail, generateTemporaryPassword } from "./admin-shared";

async function main() {
  const args = z
    .object({ email: emailSchema })
    .safeParse(parseArgs({ options: { email: { type: "string" } } }).values);
  if (!args.success) fail("Usage: --email <address>");
  const { email } = args.data;

  const admin = createAdminClient();
  const user = await findUserByEmail(admin, email);
  if (!user) fail(`No user with ${email}.`);

  const password = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) fail(`Could not reset the password: ${error.message}`);

  console.log(`Password reset for ${email} (${user.id}).`);
  console.log(`Temporary password (shown once, share it privately): ${password}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
