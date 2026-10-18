import "server-only";
import { INVALID_LINK_MESSAGE } from "@/components/public/invalid-link";
import { appEnv } from "@/lib/env";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Headers for every /api/t response (plan §5). */
export const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

/** The one answer for malformed, unknown, disabled and rotated links. */
export const invalidLink = () =>
  new Response(INVALID_LINK_MESSAGE, { status: 404, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });

export type CustomerActionResult = { ok: true } | { ok: false; error: string };

export const actionResponse = (body: CustomerActionResult, status = body.ok ? 200 : 400) =>
  Response.json(body, { status, headers: PRIVATE_HEADERS });

/** POST/DELETE must come from our own page: Origin has to equal APP_BASE_URL. */
export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === appEnv().baseUrl;
}
