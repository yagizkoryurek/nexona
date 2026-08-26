import { z } from "zod";

import { requestCoverLetter, type CoverLetter } from "@/lib/ai/cover-letter";
import { coverLetterInputSchema } from "@/lib/ai/cover-letter-schema";
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

/**
 * The one mobile route whose body carries more than an analysis id.
 *
 * `job` nests rather than flattening so `coverLetterInputSchema` can be
 * composed as-is instead of having its three fields restated here — the schema
 * is the single source of truth for what a job description may contain, and a
 * flattened copy would be a second place to keep the 50–10,000 character bound
 * in sync. It also mirrors `generateCoverLetter(analysisId, job)`, whose two
 * parameters this is the transport equivalent of.
 *
 * Imported from `./cover-letter-schema`, never from `./cover-letter` — that
 * module reaches `./gemini`, which constructs a `GoogleGenAI` client at module
 * scope. Irrelevant in a Route Handler, which is server-only, but importing it
 * from the canonical place keeps the convention intact for whoever copies this
 * file next. See CLAUDE.md's "Client/server import boundary".
 */
const requestSchema = z.object({
  analysisId: z.string().uuid(),
  job: coverLetterInputSchema,
});

/**
 * Mobile-facing Cover Letter Generator endpoint. Mirrors
 * `generateCoverLetter` (src/components/dashboard/cover-letter-action.ts) step
 * for step — same UUID and job-input validation, same RLS-scoped re-fetch,
 * same rate limiting, same Gemini call, and the same always-a-new-row
 * persistence, reusing every one of those functions directly rather than
 * reimplementing any of them.
 *
 * Two differences, both transport rather than behaviour: a mobile client has
 * no shared cookie jar with this origin, so its Supabase session arrives as a
 * bearer token (see ./route-handler.ts); and the input arrives as a JSON body
 * rather than as Server Action arguments.
 *
 * Unlike the ATS Check, Career Insights and Interview Prep routes there is no
 * "serve the stored one" branch, and that is deliberate rather than an
 * omission: a letter is keyed to a job, not just a resume, so there is no
 * single existing letter an analysis converges on. Every call generates, and
 * every generation appends a row (see migration 0004).
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

    // Re-validate server-side — a mobile client's own form validation is a UX
    // convenience, not a trust boundary, same as the web action. One combined
    // failure message for a bad id and bad job details, matching the action:
    // which half was wrong is not something a caller needs told.
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("That request couldn't be processed.", 400);
    }
    const { analysisId, job } = parsed.data;

    // No explicit user_id filter needed: RLS already scopes this select to the
    // caller's own rows, so a foreign or nonexistent id resolves to zero rows
    // either way — the same generic error avoids leaking which case it was.
    const { data: row, error: fetchError } = await supabase
      .from("resume_analyses")
      .select(
        "resume_text, overall_score, ats_score, summary, strengths, weaknesses, suggestions",
      )
      .eq("id", analysisId)
      .single();

    if (fetchError) {
      // Logged, not surfaced: the user-facing message stays generic, but a real
      // query failure — schema drift, connectivity — must not be silently
      // indistinguishable from "no such row".
      console.error("Failed to fetch analysis for cover letter:", fetchError);
      return jsonError("That analysis couldn't be found.", 404);
    }

    if (!row || !row.resume_text) {
      return jsonError("That analysis couldn't be found.", 404);
    }

    const reservation = await reserveAiUsage(supabase, "cover-letter");
    if (!reservation.allowed) {
      return jsonError(
        formatRateLimitError(reservation),
        rateLimitStatus(reservation.reason),
        reservation.retryAfterSeconds,
      );
    }

    let letter: CoverLetter;
    try {
      letter = await requestCoverLetter(
        row.resume_text,
        {
          overallScore: row.overall_score,
          atsScore: row.ats_score,
          summary: row.summary,
          strengths: row.strengths as string[],
          weaknesses: row.weaknesses as string[],
          suggestions: row.suggestions as string[],
        },
        job,
      );
    } catch (error) {
      // Logged, not surfaced: the user-facing strings stay generic, but the
      // real cause — a provider outage, a quota rejection, a truncated
      // response — must not vanish.
      console.error("Cover letter generation failed:", error);
      await resolveAiUsage(supabase, reservation.reservationId, "failed");

      if (error instanceof z.ZodError) {
        return jsonError(
          "The letter came back in an unexpected shape. Please try again.",
          502,
        );
      }
      return jsonError("The letter failed to generate. Please try again.", 502);
    }
    await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

    const { error: insertError } = await supabase.from("cover_letters").insert({
      analysis_id: analysisId,
      user_id: user.id,
      job_title: job.jobTitle,
      company_name: job.companyName ?? null,
      job_description: job.jobDescription,
      letter: letter.letter,
    });

    if (insertError) {
      console.error("Failed to save cover letter:", insertError);
    }

    // The letter is returned either way. It is the deliverable and the model
    // call is already paid for, so a failed insert costs the user their
    // history, not their result — `persisted` lets the UI say so quietly. Same
    // deliberate divergence from the analyzer route, where the row *is* the
    // product and a failed insert is a hard error.
    return Response.json({
      data: {
        letter: letter.letter,
        jobTitle: job.jobTitle,
        companyName: job.companyName ?? null,
        persisted: !insertError,
      },
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/mobile/cover-letter:", error);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
