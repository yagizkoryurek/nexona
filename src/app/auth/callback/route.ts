import { NextResponse, type NextRequest } from "next/server";

import { OAUTH_PROVIDER_PARAM, safeRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every link Supabase emails out — account confirmation and
 * password recovery both come back here — and for the return from Google
 * sign-in.
 *
 * Each carries a one-time `code`, which is exchanged for a real session before
 * the user is forwarded to wherever the flow was headed. Google's return uses
 * the same PKCE exchange; the verifier cookie was set by `signInWithGoogle`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Attacker-controlled, so it goes through the same-origin guard.
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // A Google sign-in that did not complete. Told apart by the marker
  // `signInWithGoogle` adds, not by the error, because an expired email link
  // also arrives as `error=access_denied` and must keep its own message below.
  if (searchParams.get(OAUTH_PROVIDER_PARAM) === "google") {
    const failure = new URL("/sign-in", origin);
    failure.searchParams.set(
      "notice",
      searchParams.get("error") === "access_denied"
        ? "oauth-cancelled"
        : "oauth-failed",
    );
    // Kept so that trying again — with Google or by email — still lands where
    // the user was headed.
    failure.searchParams.set("next", next);
    return NextResponse.redirect(failure);
  }

  return NextResponse.redirect(new URL("/sign-in?notice=link-invalid", origin));
}
