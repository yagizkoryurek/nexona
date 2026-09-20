import { ApiError } from "@google/genai";

/**
 * Retry-with-backoff for transient Gemini failures.
 *
 * Why this exists: `gemini-3.6-flash` intermittently answers
 * `503 UNAVAILABLE` ("This model is currently experiencing high demand") —
 * reproduced live at 3 of 6 attempts on 2026-09-20, and visible in
 * `ai_usage_events` as `resume-optimizer` runs that failed in 1.4–6.5s where a
 * real generation takes 10–14s. Before this module a single such response
 * propagated straight out of `requestStructuredJson` and became a hard
 * user-facing "The optimization failed" with no second attempt.
 *
 * Why a separate file rather than a helper inside `./gemini`: that module
 * constructs the `GoogleGenAI` client at import time, using `@/lib/env`, which
 * validates the Supabase variables at module scope too. Node's bare test runner
 * (`node --test`, see package.json) resolves neither the `@/` alias nor
 * `.env.local`, so nothing that imports `./gemini` can be unit-tested. This
 * file imports only `@google/genai`, and `./gemini` imports it — the same split,
 * for the same import-boundary reason, as `./cover-letter-schema.ts`.
 *
 * Scope: only the network call to Gemini is retried. `JSON.parse` and the Zod
 * `schema.parse` in `requestStructuredJson` run once, after this returns, so a
 * truncated or wrong-shaped response is handled exactly as before.
 */

/**
 * HTTP statuses Gemini uses for a provider-side, transient condition:
 * 503 (model overloaded / UNAVAILABLE) and 429 (rate or quota limited).
 *
 * Deliberately not retried: any other `ApiError` status (400 is our request
 * being wrong, and retrying it just repeats the mistake), and any error that is
 * not an `ApiError` at all — a plain network exception (`fetch failed`, DNS)
 * carries no `status`, so it falls through here. Widening that is a one-line
 * change to this predicate, not a redesign.
 */
const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([429, 503]);

/**
 * One initial attempt plus two retries.
 *
 * Bounded by the caller's budget, not by optimism: every consumer runs inside a
 * Server Action or route with `maxDuration = 60`, and a *successful* call
 * already takes 10–14s. A 503 fails fast (3–8s observed), so three attempts
 * plus backoff stays well inside 60s; a fourth would not reliably.
 */
export const MAX_ATTEMPTS = 3;

/**
 * Backoff before retry n is `BASE_RETRY_DELAY_MS * 2 ** (n - 1)`: 500ms, then
 * 1000ms — 1.5s added in the worst case. Short on purpose, for the same
 * duration budget as above. No jitter: this is one server making one call per
 * user action, not a fleet that could synchronise into a thundering herd.
 */
export const BASE_RETRY_DELAY_MS = 500;

/**
 * True only for the SDK's own `ApiError` carrying a retryable status. The SDK
 * attaches exactly two fields to that error — `status` (number) and `message`
 * (Gemini's JSON error body as a string) — and never surfaces a `Retry-After`
 * header, so there is nothing more precise than the status to branch on.
 */
export function isRetryableGeminiError(error: unknown): error is ApiError {
  return error instanceof ApiError && RETRYABLE_STATUS_CODES.has(error.status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying on a transient Gemini error up to `MAX_ATTEMPTS` total
 * attempts with exponential backoff. Any other error, or a retryable one on the
 * final attempt, is re-thrown as-is — never wrapped — so callers that branch on
 * `error instanceof z.ZodError` versus everything else see exactly the errors
 * they saw before this existed.
 *
 * The retry log line carries the status, the attempt count and the delay, and
 * nothing else: the request that failed contains the user's resume text, and
 * that must not reach a log.
 *
 * Generic over `fn` rather than bound to the Gemini client so the mechanics can
 * be tested with a stub that throws on a schedule — see `./gemini-retry.test.ts`.
 */
export async function retryOnTransientGeminiError<T>(
  fn: () => Promise<T>,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= MAX_ATTEMPTS;
      if (!isRetryableGeminiError(error) || isLastAttempt) {
        throw error;
      }

      const delayMs = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `Gemini call failed with status ${error.status} ` +
          `(attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }
}
