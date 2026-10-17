import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";

const LOGIN_PATH = "/giris";
const HOME_PATH = "/bugun";

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
  const { pathname } = request.nextUrl;
  const onLogin = pathname === LOGIN_PATH;

  if (!signedIn && !onLogin) return redirectKeepingCookies(request, response, LOGIN_PATH);
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
