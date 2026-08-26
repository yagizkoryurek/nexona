import type { RateLimitReason } from "@/lib/ai/rate-limit";

/**
 * Transport helpers shared by every `/api/mobile/*` route.
 *
 * These started out route-local in the Resume Analyzer endpoint, which was the
 * right call while it was the only mobile route. The ATS Check endpoint is the
 * second consumer, so they move here rather than being copied — the repo's
 * standing convention of building inline first and generalizing when a second
 * consumer actually appears.
 *
 * Deliberately transport-only. Nothing here knows about resumes, audits, or
 * Gemini; the routes keep their own domain logic and reuse the same `lib/ai`
 * functions the web Server Actions call.
 */

/**
 * The error half of the `{ data } | { error }` envelope every mobile route
 * answers in — the exact shape `readResult` in the app's `lib/api.ts` parses.
 *
 * `Retry-After` is set only when a retry hint exists. The header is standard
 * for 429 and lets a client back off intelligently instead of guessing.
 */
export function jsonError(
  error: string,
  status: number,
  retryAfterSeconds?: number | null,
) {
  const headers =
    retryAfterSeconds !== null && retryAfterSeconds !== undefined
      ? { "Retry-After": String(retryAfterSeconds) }
      : undefined;
  return Response.json({ error }, { status, headers });
}

/**
 * Extracts the bearer token, or null if the header is absent or malformed.
 *
 * A mobile client shares no cookie jar with this origin, so its Supabase
 * session arrives here instead of in cookies. Returning null rather than
 * throwing keeps the "no credentials" and "bad credentials" cases on one code
 * path — both are a 401, and neither should say which it was.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

/** Nexona's own limit (429) vs. an unrelated check failure (500) — never a passthrough of a provider status. */
export function rateLimitStatus(reason: RateLimitReason): number {
  switch (reason) {
    case "rate_limit_10m":
    case "rate_limit_hour":
    case "rate_limit_day":
    case "concurrency_limit":
      return 429;
    case "unauthenticated":
      return 401;
    case "check_failed":
      return 500;
  }
}
