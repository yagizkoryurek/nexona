/** Where an authenticated user goes when no other destination is given. */
export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

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
