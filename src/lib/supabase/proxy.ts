import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

const LOGIN_PATH = "/giris";
const HOME_PATH = "/bugun";
const ADMIN_PATH = "/admin";
const ADMIN_MFA_PATH = "/admin/mfa";

/**
 * Refreshes the Supabase session cookie on every artisan request and does the
 * optimistic redirects. Real authorisation happens again on the server
 * (lib/auth.ts and every Server Action) and in RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Nothing may run between createServerClient and getClaims (Supabase SSR rule).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  // Optimistic only: the admin panel checks role and aal2 itself (lib/admin/auth.ts).
  const isAdmin = (data?.claims?.app_metadata as { role?: unknown } | undefined)?.role === "admin";
  const { pathname } = request.nextUrl;
  const onLogin = pathname === LOGIN_PATH;

  // Signed-out visitors may see the landing page (/) and the login page; everything else needs a session.
  if (!signedIn && !onLogin && pathname !== "/") return redirectKeepingCookies(request, response, LOGIN_PATH);
  if (!signedIn) return response;

  const inAdmin = pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
  // Signed-in non-admins get a real 404 for the whole panel before anything streams.
  if (!isAdmin && inAdmin) {
    const notFound = NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
    response.cookies.getAll().forEach((cookie) => notFound.cookies.set(cookie));
    return notFound;
  }
  // The admin has no artisan app; without a TOTP-verified session only the code page.
  if (isAdmin && data?.claims?.aal !== "aal2" && pathname !== ADMIN_MFA_PATH) {
    return redirectKeepingCookies(request, response, ADMIN_MFA_PATH);
  }
  if (isAdmin && !inAdmin) return redirectKeepingCookies(request, response, ADMIN_PATH);
  if (signedIn && (onLogin || pathname === "/")) return redirectKeepingCookies(request, response, HOME_PATH);
  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
