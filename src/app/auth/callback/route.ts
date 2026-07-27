import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for every link Supabase emails out — account confirmation and
 * password recovery both come back here.
 *
 * The link carries a one-time `code`, which is exchanged for a real session
 * before the user is forwarded to wherever the flow was headed.
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

  return NextResponse.redirect(new URL("/sign-in?notice=link-invalid", origin));
}
