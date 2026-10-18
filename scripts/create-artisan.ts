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
import { createArtisanAccount } from "@/lib/admin/accounts";
import { emailSchema, fail } from "./admin-shared";

async function main() {
  const args = z
    .object({
      email: emailSchema,
      name: z.string().trim().min(1).max(80),
    })
    .safeParse(parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } }).values);
  if (!args.success) fail('Usage: --email <address> --name "<display name, 1-80 chars>"');
  const { email, name } = args.data;

  const result = await createArtisanAccount(createAdminClient(), email, name);
  if (!result.ok) fail(result.error);

  console.log(`Created artisan ${email} (${result.data.userId}).`);
  console.log(`Temporary password (shown once, share it privately): ${result.data.password}`);
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)));
