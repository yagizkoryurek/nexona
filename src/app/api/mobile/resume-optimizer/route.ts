import { z } from "zod";

import {
  formatRateLimitError,
  reserveAiUsage,
  resolveAiUsage,
} from "@/lib/ai/rate-limit";
import {
  requestResumeOptimization,
  type ResumeOptimization,
} from "@/lib/ai/resume-optimization";
import {
  bearerToken,
  jsonError,
  rateLimitStatus,
} from "@/lib/api/mobile-route";
import { createBearerClient } from "@/lib/supabase/route-handler";

// Gemini calls run inside this handler's own request lifecycle, same as the
// dashboard tool pages — see CLAUDE.md's Known Limitations for why this cap
// is currently moot on Vercel's Hobby tier.
export const maxDuration = 60;

const requestSchema = z.object({
  analysisId: z.string().uuid(),
});

/**
 * Mobile-facing Resume Optimizer endpoint. Mirrors `optimizeResume`
 * (src/components/dashboard/resume-optimize-action.ts) step for step — same
 * UUID validation, same RLS-scoped re-fetch, same rate limiting, and the same
 * Gemini call, reusing every one of those functions directly rather than
 * reimplementing any of them.
 *
 * Two differences, both transport rather than behaviour: a mobile client has
 * no shared cookie jar with this origin, so its Supabase session arrives as a
 * bearer token (see ./route-handler.ts); and the input arrives as a JSON body
 * rather than as Server Action arguments.
 *
 * This is the one AI route that persists nothing. The optimized resume is
 * returned and then forgotten — there is no `resume_optimizations` table, by
 * design (see CLAUDE.md's Current Features on the Optimizer being deliberately
 * minimal). So unlike its cached siblings there is no stored-result branch to
 * serve from, and the response carries no `persisted` flag, because nothing was
 * ever meant to be saved.
 */
export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    if (!token) {
      return jsonError("You need to sign in again.", 401);
    }

    const supabase = createBearerClient(token);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("You need to sign in again.", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Expected a JSON request body.", 400);
    }

    // Re-validate server-side — a mobile client's own check is a UX
    // convenience, not a trust boundary, same as the web action.
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("That analysis couldn't be found.", 400);
    }
    const { analysisId } = parsed.data;

    // No explicit user_id filter needed: RLS already scopes this select to the
    // caller's own rows, so a foreign or nonexistent id resolves to zero rows
    // either way — the same generic error avoids leaking which case it was.
    //
    // `file_name` is selected but unused, exactly as in the web action. Kept
    // identical so the two stay diffable; dropping it here would make this
    // route quietly disagree with its Server Action for no behavioural gain.
    const { data: row, error: fetchError } = await supabase
      .from("resume_analyses")
      .select(
        "file_name, resume_text, overall_score, ats_score, summary, strengths, weaknesses, suggestions",
      )
      .eq("id", analysisId)
      .single();

    if (fetchError) {
      // Logged, not surfaced: the user-facing message stays generic, but a real
      // query failure — schema drift, connectivity — must not be silently
      // indistinguishable from "no such row".
      console.error("Failed to fetch analysis for optimization:", fetchError);
      return jsonError("That analysis couldn't be found.", 404);
    }

    if (!row || !row.resume_text) {
      return jsonError("That analysis couldn't be found.", 404);
    }

    const reservation = await reserveAiUsage(supabase, "resume-optimizer");
    if (!reservation.allowed) {
      return jsonError(
        formatRateLimitError(reservation),
        rateLimitStatus(reservation.reason),
        reservation.retryAfterSeconds,
      );
    }

    let optimization: ResumeOptimization;
    try {
      optimization = await requestResumeOptimization(row.resume_text, {
        overallScore: row.overall_score,
        atsScore: row.ats_score,
        summary: row.summary,
        strengths: row.strengths as string[],
        weaknesses: row.weaknesses as string[],
        suggestions: row.suggestions as string[],
      });
    } catch (error) {
      // Logged, not surfaced: the user-facing strings stay generic, but the
      // real cause — a provider outage, a quota rejection, a malformed
      // response — must not vanish.
      console.error("Resume optimization failed:", error);
      await resolveAiUsage(supabase, reservation.reservationId, "failed");

      if (error instanceof z.ZodError) {
        return jsonError(
          "The optimization came back in an unexpected shape. Please try again.",
          502,
        );
      }
      return jsonError("The optimization failed. Please try again.", 502);
    }
    await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

    return Response.json({ data: optimization });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/mobile/resume-optimizer:",
      error,
    );
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
