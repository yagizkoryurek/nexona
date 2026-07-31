"use server";

import { z } from "zod";

import { requestCoverLetter, type CoverLetter } from "@/lib/ai/cover-letter";
import {
  coverLetterInputSchema,
  type CoverLetterInput,
} from "@/lib/ai/cover-letter-schema";
import { createClient } from "@/lib/supabase/server";

const analysisIdSchema = z.string().uuid();

export type CoverLetterResult = {
  letter: string;
  jobTitle: string;
  companyName: string | null;
  /** False when the letter was generated but could not be saved. */
  persisted: boolean;
};

export type CoverLetterListItem = {
  id: string;
  jobTitle: string;
  companyName: string | null;
  createdAt: string;
};

/**
 * Generates a new cover letter for one of the caller's own analyses.
 *
 * Unlike the ATS Check, there is no "serve the stored one" branch: a cover
 * letter is keyed to a job, not just a resume, so there is no single existing
 * letter to return instead of generating — every call is a fresh generation,
 * and every generation is a new row (see migration 0004 for why the table has
 * no unique constraint on analysis_id).
 */
export async function generateCoverLetter(
  analysisId: string,
  job: CoverLetterInput,
): Promise<{ data: CoverLetterResult } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in again." };
  }

  // Re-validate server-side — the client's form validation is a UX
  // convenience, not a trust boundary; this action is directly callable.
  const idResult = analysisIdSchema.safeParse(analysisId);
  const jobResult = coverLetterInputSchema.safeParse(job);
  if (!idResult.success || !jobResult.success) {
    return { error: "That request couldn't be processed." };
  }

  // No explicit user_id filter needed: RLS already scopes this select to the
  // caller's own rows, so a foreign or nonexistent id resolves to zero rows
  // either way — the same generic error either way avoids leaking which case
  // it was.
  const { data: row, error: fetchError } = await supabase
    .from("resume_analyses")
    .select(
      "resume_text, overall_score, ats_score, summary, strengths, weaknesses, suggestions",
    )
    .eq("id", idResult.data)
    .single();

  if (fetchError) {
    // Logged, not surfaced: the user-facing message stays generic on purpose,
    // but a real query failure — schema drift, connectivity — must not be
    // silently indistinguishable from "no such row".
    console.error("Failed to fetch analysis for cover letter:", fetchError);
    return { error: "That analysis couldn't be found." };
  }

  if (!row || !row.resume_text) {
    return { error: "That analysis couldn't be found." };
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
      jobResult.data,
    );
  } catch (error) {
    // Logged, not surfaced: the user-facing strings stay generic, but the real
    // cause — a provider outage, a quota rejection, a truncated response —
    // must not vanish.
    console.error("Cover letter generation failed:", error);

    if (error instanceof z.ZodError) {
      return {
        error: "The letter came back in an unexpected shape. Please try again.",
      };
    }
    return { error: "The letter failed to generate. Please try again." };
  }

  const { error: insertError } = await supabase.from("cover_letters").insert({
    analysis_id: idResult.data,
    user_id: user.id,
    job_title: jobResult.data.jobTitle,
    company_name: jobResult.data.companyName ?? null,
    job_description: jobResult.data.jobDescription,
    letter: letter.letter,
  });

  if (insertError) {
    console.error("Failed to save cover letter:", insertError);
  }

  // The letter is returned either way. It is the deliverable and the model
  // call is already paid for, so a failed insert costs the user their
  // history, not their result — `persisted` lets the UI say so quietly. This
  // deliberately diverges from `analyzeResume`, which errors outright on a
  // failed insert: there the row *is* the product, since the analysis is what
  // gets stored.
  return {
    data: {
      letter: letter.letter,
      jobTitle: jobResult.data.jobTitle,
      companyName: jobResult.data.companyName ?? null,
      persisted: !insertError,
    },
  };
}

/**
 * Past letters generated for one analysis, newest first. Not wired into the
 * UI this sprint (Cover Letter Generator ships without a history view, same
 * scope decision as the Optimizer and ATS Check) — kept here because the
 * query is cheap and correct to have, and a future history view is the
 * obvious next ask.
 */
export async function listCoverLetters(
  analysisId: string,
): Promise<{ data: CoverLetterListItem[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You need to sign in again." };
  }

  const idResult = analysisIdSchema.safeParse(analysisId);
  if (!idResult.success) {
    return { error: "That analysis couldn't be found." };
  }

  const { data, error } = await supabase
    .from("cover_letters")
    .select("id, job_title, company_name, created_at")
    .eq("analysis_id", idResult.data)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to list cover letters:", error);
    return { error: "Couldn't load past letters." };
  }

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      jobTitle: row.job_title,
      companyName: row.company_name,
      createdAt: row.created_at,
    })),
  };
}
