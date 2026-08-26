import { z } from "zod";

import {
  INTERVIEW_PREP_SCHEMA_VERSION,
  interviewPrepSchema,
  requestInterviewPrep,
  type InterviewPrep,
} from "@/lib/ai/interview-prep";
import {
  formatRateLimitError,
  reserveAiUsage,
  resolveAiUsage,
} from "@/lib/ai/rate-limit";
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
  /** Force fresh preparation instead of serving the stored set. */
  refresh: z.boolean().optional().default(false),
});

/**
 * Mobile-facing Interview Preparation endpoint. Mirrors
 * `generateInterviewPrep` (src/components/dashboard/interview-prep-action.ts)
 * step for step — same UUID validation, same RLS-scoped re-fetch, same
 * stored-prep cache with re-validation on read, same rate limiting, same
 * Gemini call, and the same append-only persistence — reusing every one of
 * those functions directly rather than reimplementing any of them.
 *
 * Two differences, both transport rather than behaviour: a mobile client has
 * no shared cookie jar with this origin, so its Supabase session arrives as a
 * bearer token (see ./route-handler.ts); and the input arrives as a JSON body
 * rather than as Server Action arguments.
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
    const { analysisId, refresh } = parsed.data;

    // Deliberately narrower than every sibling route's select: no
    // overall_score, no ats_score, no suggestions. This tool is never shown the
    // scores at all — they measure the resume as a document, which says nothing
    // about what a hiring manager would ask, and a real interviewer has no
    // access to them either. Withholding at the query rather than in the prompt
    // is the point: the model cannot be shown what was never fetched, so the
    // containment does not depend on prompt wording holding. "Fixing" this
    // select to match the other routes would silently undo it. See CLAUDE.md's
    // Development Rules, "Withhold at the query, not just in the prompt".
    //
    // No explicit user_id filter needed: RLS already scopes this select to the
    // caller's own rows, so a foreign or nonexistent id resolves to zero rows
    // either way — the same generic error avoids leaking which case it was.
    const { data: row, error: fetchError } = await supabase
      .from("resume_analyses")
      .select("file_name, resume_text, summary, strengths, weaknesses")
      .eq("id", analysisId)
      .single();

    if (fetchError) {
      // Logged, not surfaced: the user-facing message stays generic, but a real
      // query failure — schema drift, connectivity — must not be silently
      // indistinguishable from "no such row".
      console.error("Failed to fetch analysis for interview prep:", fetchError);
      return jsonError("That analysis couldn't be found.", 404);
    }

    if (!row || !row.resume_text) {
      return jsonError("That analysis couldn't be found.", 404);
    }

    if (!refresh) {
      const { data: storedRows, error: storedError } = await supabase
        .from("interview_preps")
        .select("prep, schema_version")
        .eq("analysis_id", analysisId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (storedError) {
        // Not fatal: a failed read of the cache falls through to fresh
        // generation rather than denying the user a result they can still be
        // given.
        console.error("Failed to read stored interview prep:", storedError);
      }

      const stored = storedRows?.[0];
      if (stored) {
        // Validated on the way out, not just on the way in. A row was valid
        // when written, but the schema evolves and this one may predate the
        // current shape — stored jsonb is untrusted input like any other.
        const validated = interviewPrepSchema.safeParse(stored.prep);

        if (validated.success) {
          return Response.json({
            data: {
              prep: validated.data,
              fileName: row.file_name,
              source: "stored",
              persisted: true,
            },
          });
        }

        console.error("Stored interview prep failed validation; regenerating.", {
          schemaVersion: stored.schema_version,
          issues: validated.error.issues,
        });
      }
    }

    // Reserved only now, after the cache-hit path above has had its chance to
    // return — so re-opening a stored preparation never consumes a usage slot,
    // and a `refresh` (which skips the cache-check block entirely) reserves
    // like any other fresh generation.
    const reservation = await reserveAiUsage(supabase, "interview-prep");
    if (!reservation.allowed) {
      return jsonError(
        formatRateLimitError(reservation),
        rateLimitStatus(reservation.reason),
        reservation.retryAfterSeconds,
      );
    }

    let prep: InterviewPrep;
    try {
      prep = await requestInterviewPrep(row.resume_text, {
        summary: row.summary,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
      });
    } catch (error) {
      // Logged, not surfaced: the user-facing strings stay generic, but the
      // real cause — a provider outage, a quota rejection, a truncated
      // response — must not vanish.
      console.error("Interview prep generation failed:", error);
      await resolveAiUsage(supabase, reservation.reservationId, "failed");

      if (error instanceof z.ZodError) {
        return jsonError(
          "The preparation came back in an unexpected shape. Please try again.",
          502,
        );
      }
      return jsonError("The preparation failed. Please try again.", 502);
    }
    await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

    const { error: insertError } = await supabase
      .from("interview_preps")
      .insert({
        analysis_id: analysisId,
        user_id: user.id,
        prep,
        schema_version: INTERVIEW_PREP_SCHEMA_VERSION,
      });

    if (insertError) {
      console.error("Failed to save interview prep:", insertError);
    }

    // The preparation is returned either way. It is the deliverable and the
    // model call is already paid for, so a failed insert costs the user their
    // history, not their result — `persisted` lets the UI say so quietly. Same
    // deliberate divergence from the analyzer route, where the row *is* the
    // product and a failed insert is a hard error.
    return Response.json({
      data: {
        prep,
        fileName: row.file_name,
        source: "fresh",
        persisted: !insertError,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/mobile/interview-prep:",
      error,
    );
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
