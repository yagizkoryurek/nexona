"use server";

import { z } from "zod";

import {
  requestResumeAnalysis,
  type ResumeAnalysis,
} from "@/lib/ai/resume-analysis";
import {
  formatRateLimitError,
  reserveAiUsage,
  resolveAiUsage,
} from "@/lib/ai/rate-limit";
import { validateResumeFile } from "@/lib/resume-file";
import { extractResumeText } from "@/lib/resume-text-extraction";
import { createClient } from "@/lib/supabase/server";

export async function analyzeResume(
  formData: FormData,
): Promise<{ data: ResumeAnalysis } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in again." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file was provided." };
  }

  // Re-validate server-side — the client's check is a UX convenience, not a
  // trust boundary; this action is directly callable.
  const validation = validateResumeFile(file);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const extraction = await extractResumeText(file);
  if (!extraction.ok) {
    return { error: extraction.error };
  }

  const reservation = await reserveAiUsage(supabase, "resume-analyzer");
  if (!reservation.allowed) {
    return { error: formatRateLimitError(reservation) };
  }

  let analysis: ResumeAnalysis;
  try {
    analysis = await requestResumeAnalysis(extraction.text);
  } catch (error) {
    await resolveAiUsage(supabase, reservation.reservationId, "failed");

    if (error instanceof z.ZodError) {
      return {
        error:
          "The analysis came back in an unexpected shape. Please try again.",
      };
    }
    return { error: "The analysis failed. Please try again." };
  }
  await resolveAiUsage(supabase, reservation.reservationId, "succeeded");

  const { error: insertError } = await supabase.from("resume_analyses").insert({
    user_id: user.id,
    file_name: file.name,
    overall_score: analysis.overallScore,
    ats_score: analysis.atsScore,
    summary: analysis.summary,
    strengths: analysis.strengths,
    weaknesses: analysis.weaknesses,
    suggestions: analysis.suggestions,
    // Persisted so the Resume Optimizer can later rewrite the real resume,
    // not just react to the AI's summary of it. See migration 0002 and
    // CLAUDE.md's Persistence section for why this reverses the table's
    // original "never store resume text" design.
    resume_text: extraction.text,
  });

  if (insertError) {
    // Log the real Postgres error — without this the cause is invisible, since
    // the user-facing string deliberately says nothing about the database.
    // A schema mismatch here (e.g. an unapplied migration) is indistinguishable
    // from a transient failure otherwise, and "Please try again" never fixes it.
    console.error("Failed to save resume analysis:", insertError);

    return {
      error: "Analysis succeeded but couldn't be saved. Please try again.",
    };
  }

  return { data: analysis };
}
