import { z } from "zod";

import {
  requestResumeAnalysis,
  type ResumeAnalysis,
} from "@/lib/ai/resume-analysis";
import {
  formatRateLimitError,
  reserveAiUsage,
  resolveAiUsage,
  type RateLimitReason,
} from "@/lib/ai/rate-limit";
import { validateResumeFile } from "@/lib/resume-file";
import { extractResumeText } from "@/lib/resume-text-extraction";
import { createBearerClient } from "@/lib/supabase/route-handler";

// Gemini calls run inside this handler's own request lifecycle, same as the
// dashboard tool pages — see CLAUDE.md's Known Limitations for why this cap
// is currently moot on Vercel's Hobby tier.
export const maxDuration = 60;

function jsonError(
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

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token;
}

/** Nexona's own limit (429) vs. an unrelated check failure (500) — never a passthrough of a provider status. */
function rateLimitStatus(reason: RateLimitReason): number {
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

/**
 * Mobile-facing Resume Analyzer endpoint. Mirrors `analyzeResume`
 * (src/components/dashboard/resume-analyze-action.ts) step for step — same
 * validation, extraction, rate limiting, Gemini call, and persistence,
 * reusing every one of those functions directly rather than reimplementing
 * any of them. The only real difference is transport: a mobile client has no
 * shared cookie jar with this origin, so its Supabase session arrives as a
 * bearer token instead of cookies (see ./route-handler.ts).
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

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError(
        "Expected a multipart/form-data request with a file.",
        400,
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonError("No file was provided.", 400);
    }

    // Re-validate server-side — a mobile client's own check is a UX
    // convenience, not a trust boundary, same as the web action.
    const validation = validateResumeFile(file);
    if (!validation.ok) {
      return jsonError(validation.error, 400);
    }

    const extraction = await extractResumeText(file);
    if (!extraction.ok) {
      return jsonError(extraction.error, 400);
    }

    const reservation = await reserveAiUsage(supabase, "resume-analyzer");
    if (!reservation.allowed) {
      return jsonError(
        formatRateLimitError(reservation),
        rateLimitStatus(reservation.reason),
        reservation.retryAfterSeconds,
      );
    }

    let analysis: ResumeAnalysis;
    try {
      analysis = await requestResumeAnalysis(extraction.text);
    } catch (error) {
      await resolveAiUsage(supabase, reservation.reservationId, "failed");

      if (error instanceof z.ZodError) {
        return jsonError(
          "The analysis came back in an unexpected shape. Please try again.",
          502,
        );
      }
      return jsonError("The analysis failed. Please try again.", 502);
    }
    await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

    const { error: insertError } = await supabase
      .from("resume_analyses")
      .insert({
        user_id: user.id,
        file_name: file.name,
        overall_score: analysis.overallScore,
        ats_score: analysis.atsScore,
        summary: analysis.summary,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
        resume_text: extraction.text,
      });

    if (insertError) {
      console.error("Failed to save resume analysis:", insertError);
      return jsonError(
        "Analysis succeeded but couldn't be saved. Please try again.",
        500,
      );
    }

    return Response.json({ data: analysis });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/mobile/resume-analyzer:",
      error,
    );
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
