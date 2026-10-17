import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Artisan routes only. Skipped: customer links (/t, /api/t), the cron
     * dispatcher (/api/internal), the privacy notice (/gizlilik), Next.js
     * internals and static files (anything with a file extension).
     */
    "/((?!t/|t$|api/t/|api/internal/|gizlilik|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
