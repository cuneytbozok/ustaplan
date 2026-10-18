/**
 * Sets a new generated temporary password for an existing artisan and prints
 * it once. The artisan should change it in Ayarlar after signing in.
 *
 *   npm run admin:reset-password -- --email usta@ornek.com
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetArtisanPassword } from "@/lib/admin/accounts";
import { emailSchema, fail, findUserByEmail } from "./admin-shared";

async function main() {
  const args = z
    .object({ email: emailSchema })
    .safeParse(parseArgs({ options: { email: { type: "string" } } }).values);
  if (!args.success) fail("Usage: --email <address>");
  const { email } = args.data;

  const admin = createAdminClient();
  const user = await findUserByEmail(admin, email);
  if (!user) fail(`No user with ${email}.`);

  const result = await resetArtisanPassword(admin, user.id);
  if (!result.ok) fail(result.code === "not_found" ? `${email} is not an artisan account.` : result.error);

  console.log(`Password reset for ${email} (${user.id}).`);
  console.log(`Temporary password (shown once, share it privately): ${result.data.password}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
