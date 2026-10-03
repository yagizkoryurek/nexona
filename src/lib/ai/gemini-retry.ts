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
 *
 * Retrying alone turned out not to be enough. On 2026-10-03 two ATS audits
 * failed after 19.3s and 28.6s — three 503s each, the backoff too short to
 * outlast a demand spike and the 60s budget too tight to add attempts. Hence
 * `withModelFallback` below: an opt-in second model, tried only after the
 * primary is still overloaded.
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
 * Primary attempts when a fallback model is configured: one fewer than
 * `MAX_ATTEMPTS`, so the fallback call fits the same budget.
 *
 * In production a failing primary attempt takes 6–9s, not the 1–2s a 503 takes
 * from a quiet client, so the worst case is two failed attempts (~18s) plus the
 * 500ms backoff plus one fallback generation — under 30s against
 * `maxDuration = 60`. A third primary attempt would land in the same spike far
 * more often than it would escape it.
 */
export const PRIMARY_ATTEMPTS_BEFORE_FALLBACK = 2;

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
 * Runs `fn`, retrying on a transient Gemini error up to `maxAttempts` total
 * attempts (default `MAX_ATTEMPTS`) with exponential backoff. Any other error, or a retryable one on the
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
  { maxAttempts = MAX_ATTEMPTS }: { maxAttempts?: number } = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= maxAttempts;
      if (!isRetryableGeminiError(error) || isLastAttempt) {
        throw error;
      }

      const delayMs = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `Gemini call failed with status ${error.status} ` +
          `(attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }
}

/**
 * Calls `call` with the primary model, under the retry above, and — only if a
 * `fallback` is given and the primary is *still* failing with a retryable
 * 503/429 — calls it once more with the fallback model.
 *
 * Without a `fallback` this is exactly `retryOnTransientGeminiError` with its
 * default `MAX_ATTEMPTS` on the primary, so every caller that does not opt in
 * behaves as it did before this existed.
 *
 * Deliberately narrow:
 * - Only a retryable `ApiError` falls back. A 400 is our request being wrong
 *   and would be wrong on any model; a network exception, an empty response, a
 *   `SyntaxError` or a `ZodError` is not a capacity problem. `requestStructuredJson`
 *   parses and validates *after* this returns, so malformed output never
 *   reaches this decision at all — and the fallback's output is validated by
 *   that same single step.
 * - The fallback is called once, never retried. Bounded at
 *   `PRIMARY_ATTEMPTS_BEFORE_FALLBACK + 1` calls in total.
 * - If the fallback fails too, its error is the one thrown, unwrapped: it is
 *   the most recent attempt, and callers branch on the error's type.
 *
 * Model names appear in this log line only, never in an error a user sees.
 */
export async function withModelFallback<T>(
  call: (model: string) => Promise<T>,
  { primary, fallback }: { primary: string; fallback?: string },
): Promise<T> {
  if (!fallback) {
    return retryOnTransientGeminiError(() => call(primary));
  }

  try {
    return await retryOnTransientGeminiError(() => call(primary), {
      maxAttempts: PRIMARY_ATTEMPTS_BEFORE_FALLBACK,
    });
  } catch (error) {
    if (!isRetryableGeminiError(error)) throw error;

    console.warn(
      `Gemini model ${primary} still failing with status ${error.status} ` +
        `after ${PRIMARY_ATTEMPTS_BEFORE_FALLBACK} attempts; ` +
        `trying ${fallback} once.`,
    );
    return await call(fallback);
  }
}
