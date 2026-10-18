import { z } from "zod";

export { findUserByEmail, generateTemporaryPassword } from "@/lib/admin/accounts";

export const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

export function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}
