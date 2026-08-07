import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
   * Scoped to the routes whose behaviour actually depends on a session: the
   * protected app, the auth-only pages that bounce a signed-in user, and the
   * reset flow (whose recovery token has to stay fresh while the user types a
   * new password).
   *
   * Deliberately NOT a catch-all. Every matched request costs a `getUser()`
   * round-trip to the Supabase Auth server, and `/`, `/terms` and `/privacy`
   * are statically prerendered pages that render nothing user-specific — an
   * authenticated visitor to `/` sees the same landing page as anyone else,
   * so the session is never consulted there. Paying for a network call on the
   * highest-traffic public route buys nothing.
   *
   * `/auth/callback` is excluded on purpose: it exchanges a one-time PKCE code
   * for a session using its own Supabase client, so a `getUser()` ahead of
   * that exchange does no useful work on a request that has no session yet.
   */
  matcher: [
    "/dashboard/:path*",
    "/sign-in",
    "/get-started",
    "/forgot-password",
    "/reset-password",
  ],
};
