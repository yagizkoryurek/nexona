import type { createClient } from "@/lib/supabase/server";

// Shared AI-usage rate limiter — every Server Action that calls Gemini calls
// `reserveAiUsage` first and `resolveAiUsage` after, the same way every AI
// module already shares `requestStructuredJson` from ./gemini. The actual
// limit checking, the concurrency cap, and the atomicity guarantee all live
// in two Postgres functions (migration 0007) — this module is a thin,
// typed wrapper around `supabase.rpc(...)`, not a second place the logic is
// implemented. See migration 0007 for why a database-side check is required
// at all: a plain count-then-insert from Node has a race under concurrent
// Vercel invocations that only an atomic, lock-guarded database function
// closes.

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Matches the dashboard route segment exactly (src/app/dashboard/<tool>). */
export type AiTool =
  | "resume-analyzer"
  | "resume-optimizer"
  | "ats-checker"
  | "cover-letter"
  | "career-insights"
  | "interview-prep";

type UsageLimits = {
  limit10m: number;
  limitHour: number;
  limitDay: number;
  maxConcurrent: number;
};

/** Beta: one common policy for every user, no Free/Pro differentiation yet. */
const BETA_LIMITS: UsageLimits = {
  limit10m: 15,
  limitHour: 50,
  limitDay: 100,
  maxConcurrent: 2,
};

/**
 * The seam for a future Free/Pro split. `reserve_ai_usage` (migration 0007)
 * takes these four numbers as parameters with Beta defaults rather than
 * enforcing hardcoded thresholds, so the Postgres function stays plan-
 * agnostic — extending this later to read a plan column needs no SQL change,
 * only this function branching on it.
 */
function getLimitsForUser(): UsageLimits {
  return BETA_LIMITS;
}

export type RateLimitReason =
  | "rate_limit_10m"
  | "rate_limit_hour"
  | "rate_limit_day"
  | "concurrency_limit"
  | "unauthenticated"
  /** The reservation check itself failed (network, schema drift) — not a real limit. */
  | "check_failed";

export type ReserveResult =
  | { allowed: true; reservationId: string }
  | {
      allowed: false;
      reason: RateLimitReason;
      retryAfterSeconds: number | null;
    };

/**
 * Reserves one AI usage slot for the signed-in caller, or reports why not.
 * Must be called after the action's own `getUser()`/validation, immediately
 * before the Gemini call — never before a cache-hit path has had a chance to
 * return, so a served-from-cache result never consumes a reservation.
 */
export async function reserveAiUsage(
  supabase: SupabaseServerClient,
  tool: AiTool,
): Promise<ReserveResult> {
  const limits = getLimitsForUser();

  const { data, error } = await supabase.rpc("reserve_ai_usage", {
    p_tool: tool,
    p_limit_10m: limits.limit10m,
    p_limit_hour: limits.limitHour,
    p_limit_day: limits.limitDay,
    p_max_concurrent: limits.maxConcurrent,
  });

  if (error) {
    // Fail closed (no reservation, Gemini never called) but with a distinct
    // reason: telling a user they hit their usage limit when the check
    // itself is what failed would be dishonest. The caller maps this to the
    // same generic "something went wrong" copy as a Gemini failure, not the
    // rate-limit message.
    console.error("AI usage reservation check failed:", error);
    return { allowed: false, reason: "check_failed", retryAfterSeconds: null };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || !row.allowed) {
    return {
      allowed: false,
      reason: (row?.reason as RateLimitReason | undefined) ?? "check_failed",
      retryAfterSeconds: row?.retry_after_seconds ?? null,
    };
  }

  return { allowed: true, reservationId: row.reservation_id as string };
}

/**
 * Records the outcome of a reservation once the Gemini call finishes,
 * freeing its concurrency slot. Never throws — a failed resolve must not
 * turn a successful user-facing result into an error. The 90-second
 * staleness cutoff inside `reserve_ai_usage` is the safety net if this call
 * itself never lands: an unresolved reservation stops counting as in-flight
 * on its own after that window.
 */
export async function resolveAiUsage(
  supabase: SupabaseServerClient,
  reservationId: string,
  outcome: "succeeded" | "failed",
): Promise<void> {
  const { error } = await supabase.rpc("resolve_ai_usage", {
    p_reservation_id: reservationId,
    p_outcome: outcome,
  });

  if (error) {
    console.error("Failed to resolve AI usage reservation:", error);
  }
}

function humanizeRetryAfter(seconds: number): string {
  if (seconds < 60) return "a few seconds";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * Maps an internal rejection reason to a user-facing message. No technical
 * term (RPM, TPM, quota, HTTP status, "Gemini") ever appears here — see
 * CLAUDE.md's AI Architecture notes on why the ATS Check withholds the
 * stored score from its own prompt for the same "don't leak internals"
 * reasoning applied to a different layer.
 */
export function formatRateLimitError(result: {
  reason: RateLimitReason;
  retryAfterSeconds: number | null;
}): string {
  const { reason, retryAfterSeconds } = result;
  const limits = getLimitsForUser();

  switch (reason) {
    case "rate_limit_10m":
    case "rate_limit_hour":
      return `You've reached your AI usage limit for now. Try again in ${
        retryAfterSeconds !== null
          ? humanizeRetryAfter(retryAfterSeconds)
          : "a little while"
      }.`;
    case "rate_limit_day":
      return "Daily AI limit reached. Please try again tomorrow.";
    case "concurrency_limit":
      return `You can only run ${limits.maxConcurrent} AI requests at once. Please wait for one to finish, then try again in a few seconds.`;
    case "unauthenticated":
      return "You need to sign in again.";
    case "check_failed":
      return "We couldn't process your request right now. Please try again.";
  }
}
