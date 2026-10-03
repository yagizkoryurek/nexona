/** Where an authenticated user goes when no other destination is given. */
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

/**
 * Query parameter `signInWithGoogle` adds to its `/auth/callback` URL, so the
 * callback can tell a Google sign-in from an emailed link.
 *
 * Needed because both report failure the same way: an expired email link and a
 * cancelled Google consent screen each arrive with `error=access_denied`. Only
 * the message shown depends on it — it grants nothing, so a forged value can at
 * most change which notice the sign-in page displays.
 */
export const OAUTH_PROVIDER_PARAM = "provider";

/**
 * Sanitises a user-supplied `next` destination.
 *
 * `next` arrives from the query string, so it is attacker-controlled input
 * reflected straight into a redirect. Without this check,
 * `/sign-in?next=https://evil.example` would hand a freshly-authenticated user
 * to another origin. Only same-origin absolute paths are allowed —
 * `//evil.example` counts as an origin, not a path, so a second leading slash
 * (or a backslash, which some browsers normalise to one) is rejected too.
 */
export function safeRedirectPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  return next;
}
