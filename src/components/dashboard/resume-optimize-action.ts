"use server";

import { z } from "zod";

import {
  requestResumeOptimization,
  type ResumeOptimization,
} from "@/lib/ai/resume-optimization";
import { createClient } from "@/lib/supabase/server";

const analysisIdSchema = z.string().uuid();

export async function optimizeResume(
  analysisId: string,
): Promise<{ data: ResumeOptimization } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in again." };
  }

  // Re-validate server-side — the client's selection is a UX convenience,
  // not a trust boundary; this action is directly callable.
  const idResult = analysisIdSchema.safeParse(analysisId);
  if (!idResult.success) {
    return { error: "That analysis couldn't be found." };
  }

  // No explicit user_id filter needed: RLS already scopes this select to the
  // caller's own rows, so a foreign or nonexistent id resolves to zero rows
  // either way — the same generic error either way avoids leaking which case
  // it was.
  const { data: row, error: fetchError } = await supabase
    .from("resume_analyses")
    .select(
      "file_name, resume_text, overall_score, ats_score, summary, strengths, weaknesses, suggestions",
    )
    .eq("id", idResult.data)
    .single();

  if (fetchError) {
    // Logged, not surfaced: the user-facing message stays generic on purpose
    // (see above), but a real query failure — schema drift, connectivity —
    // must not be silently indistinguishable from "no such row".
    console.error("Failed to fetch analysis for optimization:", fetchError);
    return { error: "That analysis couldn't be found." };
  }

  if (!row || !row.resume_text) {
    return { error: "That analysis couldn't be found." };
  }

  try {
    const optimization = await requestResumeOptimization(row.resume_text, {
      overallScore: row.overall_score,
      atsScore: row.ats_score,
      summary: row.summary,
      strengths: row.strengths as string[],
      weaknesses: row.weaknesses as string[],
      suggestions: row.suggestions as string[],
    });

    return { data: optimization };
  } catch (error) {
    // Logged, not surfaced: the user-facing strings stay generic, but the real
    // cause — a provider outage, a quota rejection, a malformed response —
    // must not vanish silently. Debugging this pipeline without it means
    // re-adding instrumentation from scratch.
    console.error("Resume optimization failed:", error);

    if (error instanceof z.ZodError) {
      return {
        error:
          "The optimization came back in an unexpected shape. Please try again.",
      };
    }
    return { error: "The optimization failed. Please try again." };
  }
}
