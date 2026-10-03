/**
 * Error mapping for the auth actions that send an email — sign-up, the sign-up
 * resend, and password recovery.
 *
 * Kept free of any Supabase or React import so it is testable on Node's
 * built-in runner, and safe to import from a client component (the cooldown
 * constants below are read by the forms that start a countdown).
 */

export const GENERIC_AUTH_ERROR = "Something went wrong. Please try again.";

export const RATE_LIMITED_ERROR =
  "You're sending requests too quickly. Please wait a few minutes before trying again.";

/**
 * How long the resend controls stay locked after Supabase has confirmed a rate
 * limit. Supabase's `AuthError` carries a `code` and a `status` but never a
 * retry-after value, so this is a chosen window rather than a server-provided
 * one — long enough that the next attempt is unlikely to be throttled again.
 */
export const RATE_LIMITED_COOLDOWN_SECONDS = 300;

const RATE_LIMIT_CODES: ReadonlySet<string> = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

export type AuthEmailResult = { error?: string; retryAfterSeconds?: number };

/**
 * Maps a Supabase Auth error from an email-sending call to user-facing copy.
 *
 * A rate limit gets its own message and a cooldown hint, because the generic
 * "please try again" is exactly the wrong advice for it — retrying immediately
 * spends more of the same allowance. Every other code keeps the generic copy;
 * callers handle any code they want to special-case before calling this.
 */
export function mapAuthEmailError(error: { code?: string | null }): {
  error: string;
  retryAfterSeconds?: number;
} {
  if (error.code && RATE_LIMIT_CODES.has(error.code)) {
    return {
      error: RATE_LIMITED_ERROR,
      retryAfterSeconds: RATE_LIMITED_COOLDOWN_SECONDS,
    };
  }

  return { error: GENERIC_AUTH_ERROR };
}
