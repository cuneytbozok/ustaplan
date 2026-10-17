import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { supabaseEnv } from "@/lib/env";

/**
 * User-scoped client for Server Components, Server Actions and Route
 * Handlers. Every query runs under the artisan's RLS policies.
 */
export async function createClient() {
  // Artisan data is never prerendered: connection() stops prerendering here
  // (Supabase checks token expiry with the current time), so the build needs
  // no Supabase variables either.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
