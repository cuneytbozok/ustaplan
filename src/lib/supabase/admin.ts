import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { adminEnv } from "@/lib/env";

/**
 * Secret-key client that bypasses RLS. Server-only: admin scripts, the
 * token-verified customer endpoints and the dispatcher. Never use it for
 * artisan requests, which go through the user-scoped client.
 */
export function createAdminClient() {
  const { url, secretKey } = adminEnv();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
