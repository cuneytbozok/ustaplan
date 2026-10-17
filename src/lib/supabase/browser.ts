"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser client with the artisan's session (publishable key only). Used for
 * direct Storage uploads; storage policies limit it to the user's own job folders.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
