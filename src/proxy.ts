import { NextResponse, type NextRequest } from "next/server";
import { verifyCustomerToken } from "@/lib/customer-link";
import { updateSession } from "@/lib/supabase/proxy";

const INVALID_LINK_PATH = "/t/gecersiz";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/t/")) return customerLinkGate(request, pathname.slice(3));
  return updateSession(request);
}

/**
 * Customer pages stream, so the page itself can't change the status code once
 * it starts. Checking the token here gives malformed, unknown, disabled and
 * regenerated links one identical real 404 (plan §5). The page verifies again.
 */
async function customerLinkGate(request: NextRequest, token: string) {
  if (`/t/${token}` === INVALID_LINK_PATH) return NextResponse.next();
  const valid = !token.includes("/") && (await verifyCustomerToken(decodeURIComponent(token)));
  if (valid) return NextResponse.next();
  return NextResponse.rewrite(new URL(INVALID_LINK_PATH, request.url), { status: 404 });
}

export const config = {
  matcher: [
    /*
     * Artisan routes (session refresh + login redirects). Skipped: customer
     * links, the cron dispatcher (/api/internal), the privacy notice
     * (/gizlilik), the landing page's share image, Next.js internals and
     * static files (anything with a file extension).
     */
    "/((?!t/|t$|api/t/|api/internal/|gizlilik|opengraph-image|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
    // Customer link pages only: the token gate above. /api/t answers 404 itself.
    "/t/:token",
  ],
};
