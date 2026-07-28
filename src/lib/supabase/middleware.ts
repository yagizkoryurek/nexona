import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/auth-redirect";

/** Requires a session. Everything nested underneath is covered too. */
const PROTECTED_PREFIXES = [DEFAULT_AUTHENTICATED_PATH];

/**
 * Pointless for a signed-in user, so they get bounced to the dashboard.
 *
 * "/" is deliberately absent: it's the public marketing page, not an
 * auth-only page, and it stays reachable regardless of session state —
 * only explicit sign-in/sign-up routes a user into the app.
 *
 * `/reset-password` is deliberately absent: a user arriving from a recovery
 * email *is* signed in (the callback exchanged the link for a recovery
 * session), so listing it here would make the reset flow impossible to
 * complete. That page guards itself instead.
 */
const AUTH_ONLY_PATHS = ["/sign-in", "/get-started", "/forgot-password"];

const isProtected = (pathname: string) =>
  PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

/**
 * Refreshes the Supabase session, then applies route protection.
 *
 * The refresh is not optional: `getUser()` revalidates the token against the
 * Supabase Auth server and writes any rotated cookies onto the response, so
 * every Server Component downstream reads an already-fresh session. Without
 * it, sessions expire mid-render instead of renewing.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          supabaseResponse = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }

          // Responses that set auth cookies must never be cached by a CDN or
          // proxy, or one user's session could be served to another.
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // `getUser()` rather than `getSession()`: the latter trusts whatever is in
  // the cookie without verifying it, which is not good enough for a decision
  // about who may see a protected page.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    return redirectTo(
      request,
      supabaseResponse,
      `/sign-in?next=${encodeURIComponent(pathname)}`,
    );
  }

  if (user && AUTH_ONLY_PATHS.includes(pathname)) {
    return redirectTo(request, supabaseResponse, DEFAULT_AUTHENTICATED_PATH);
  }

  return supabaseResponse;
}

/**
 * Redirects while preserving any cookies the refresh above just wrote —
 * dropping them would sign the user straight back out.
 */
function redirectTo(
  request: NextRequest,
  currentResponse: NextResponse,
  path: string,
) {
  const response = NextResponse.redirect(new URL(path, request.url));

  for (const cookie of currentResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  return response;
}
