"use server";

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
import { createClient } from "@/lib/supabase/server";

const analysisIdSchema = z.string().uuid();

export type InterviewPrepResult = {
  prep: InterviewPrep;
  fileName: string;
  /** Whether this came from the database or from a fresh model call. */
  source: "stored" | "fresh";
  /** False when fresh preparation was generated but could not be saved. */
  persisted: boolean;
};

/**
 * Returns interview preparation for one of the caller's own analyses.
 *
 * Reads stored preparation when it exists, so re-opening a resume costs
 * nothing and the persisted rows are actually read back rather than
 * write-only. Pass `refresh` to force regeneration; each one appends a row
 * rather than replacing the last (see migration 0006 for why the table is
 * append-only).
 */
export async function generateInterviewPrep(
  analysisId: string,
  refresh = false,
): Promise<{ data: InterviewPrepResult } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in again." };
  }

  // Re-validate server-side — the client's selection is a UX convenience, not
  // a trust boundary; this action is directly callable.
  const idResult = analysisIdSchema.safeParse(analysisId);
  if (!idResult.success) {
    return { error: "That analysis couldn't be found." };
  }

  // Deliberately narrower than the other tools' selects: no overall_score, no
  // ats_score, no suggestions. This tool is never shown the scores at all —
  // they measure the resume as a document, which says nothing about what a
  // hiring manager would ask, and a real interviewer has no access to them
  // either. See `requestInterviewPrep` for the full reasoning.
  //
  // No explicit user_id filter needed: RLS already scopes this select to the
  // caller's own rows, so a foreign or nonexistent id resolves to zero rows
  // either way — the same generic error avoids leaking which case it was.
  const { data: row, error: fetchError } = await supabase
    .from("resume_analyses")
    .select("file_name, resume_text, summary, strengths, weaknesses")
    .eq("id", idResult.data)
    .single();

  if (fetchError) {
    // Logged, not surfaced: the user-facing message stays generic, but a real
    // query failure — schema drift, connectivity — must not be silently
    // indistinguishable from "no such row".
    console.error("Failed to fetch analysis for interview prep:", fetchError);
    return { error: "That analysis couldn't be found." };
  }

  if (!row || !row.resume_text) {
    return { error: "That analysis couldn't be found." };
  }

  if (!refresh) {
    const { data: storedRows, error: storedError } = await supabase
      .from("interview_preps")
      .select("prep, schema_version")
      .eq("analysis_id", idResult.data)
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
      // Validated on the way out, not just on the way in. A row was valid when
      // written, but the schema evolves and this one may predate the current
      // shape — stored jsonb is untrusted input like any other.
      const validated = interviewPrepSchema.safeParse(stored.prep);

      if (validated.success) {
        return {
          data: {
            prep: validated.data,
            fileName: row.file_name,
            source: "stored",
            persisted: true,
          },
        };
      }

      console.error("Stored interview prep failed validation; regenerating.", {
        schemaVersion: stored.schema_version,
        issues: validated.error.issues,
      });
    }
  }

  // Reserved only now, after the cache-hit path above has had its chance to
  // return — see ats-audit-action.ts for the identical reasoning.
  const reservation = await reserveAiUsage(supabase, "interview-prep");
  if (!reservation.allowed) {
    return { error: formatRateLimitError(reservation) };
  }

  let prep: InterviewPrep;
  try {
    prep = await requestInterviewPrep(row.resume_text, {
      summary: row.summary,
      strengths: row.strengths,
      weaknesses: row.weaknesses,
    });
  } catch (error) {
    // Logged, not surfaced: the user-facing strings stay generic, but the real
    // cause — a provider outage, a quota rejection, a truncated response —
    // must not vanish.
    console.error("Interview prep generation failed:", error);
    await resolveAiUsage(supabase, reservation.reservationId, "failed");

    if (error instanceof z.ZodError) {
      return {
        error:
          "The preparation came back in an unexpected shape. Please try again.",
      };
    }
    return { error: "The preparation failed. Please try again." };
  }
  await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

  const { error: insertError } = await supabase.from("interview_preps").insert({
    analysis_id: idResult.data,
    user_id: user.id,
    prep,
    schema_version: INTERVIEW_PREP_SCHEMA_VERSION,
  });

  if (insertError) {
    console.error("Failed to save interview prep:", insertError);
  }

  // The preparation is returned either way. It is the deliverable and the
  // model call is already paid for, so a failed insert costs the user their
  // history, not their result — `persisted` lets the UI say so quietly. This
  // deliberately diverges from `analyzeResume`, which errors outright on a
  // failed insert: there the row *is* the product, since the analysis is what
  // gets stored.
  return {
    data: {
      prep,
      fileName: row.file_name,
      source: "fresh",
      persisted: !insertError,
    },
  };
}
