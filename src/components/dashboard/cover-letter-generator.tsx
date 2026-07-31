"use client";

import * as React from "react";

import type { CoverLetterInput } from "@/lib/ai/cover-letter-schema";

import {
  generateCoverLetter,
  type CoverLetterResult,
} from "./cover-letter-action";
import { CoverLetterJobForm } from "./cover-letter-job-form";
import { CoverLetterResults } from "./cover-letter-results";
import { ResumePicker, type SelectableAnalysis } from "./resume-picker";

type Phase = "select" | "details" | "generating" | "results";

type CoverLetterGeneratorProps = {
  analyses: SelectableAnalysis[];
};

/**
 * Owns the select -> details -> generating -> results flow and the Server
 * Action call. One phase more than the Optimizer or ATS Check, because a
 * cover letter needs job details collected, not just an existing analysis
 * selected.
 *
 * No "already generated" branch the way the ATS Check has one: a letter is
 * keyed to a job, not just a resume, so there is no single existing letter to
 * serve instead of generating — see cover-letter-action.ts.
 */
export function CoverLetterGenerator({ analyses }: CoverLetterGeneratorProps) {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [lastJob, setLastJob] = React.useState<CoverLetterInput | null>(null);
  const [result, setResult] = React.useState<CoverLetterResult | null>(null);
  const [generateError, setGenerateError] = React.useState<string | null>(null);

  const handleSelect = (analysisId: string) => {
    setGenerateError(null);
    setSelectedId(analysisId);
    setPhase("details");
  };

  const handleSubmitJob = async (job: CoverLetterInput) => {
    if (!selectedId) return;

    setGenerateError(null);
    setLastJob(job);
    setPhase("generating");

    const response = await generateCoverLetter(selectedId, job);

    if ("error" in response) {
      setGenerateError(response.error);
      setPhase("details");
      return;
    }

    setResult(response.data);
    setPhase("results");
  };

  // Returns to the job form with the same resume and the same job details
  // prefilled, so writing several variants for one job doesn't mean
  // re-picking the resume or retyping the posting.
  const generateAnother = () => {
    setResult(null);
    setPhase("details");
  };

  const chooseDifferentResume = () => {
    setSelectedId(null);
    setLastJob(null);
    setResult(null);
    setGenerateError(null);
    setPhase("select");
  };

  if (phase === "results" && result) {
    return (
      <CoverLetterResults
        letter={result.letter}
        jobTitle={result.jobTitle}
        companyName={result.companyName}
        persisted={result.persisted}
        onGenerateAnother={generateAnother}
        onChooseDifferentResume={chooseDifferentResume}
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed text-pretty">
        Pick a previous analysis, tell us about the job, and we&apos;ll write a
        cover letter grounded in that resume.
      </p>

      {generateError && (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {generateError}
        </p>
      )}

      <div className="mt-7 w-full">
        {phase === "select" && (
          <ResumePicker
            analyses={analyses}
            onSelect={handleSelect}
            emptyStateDescription="You don't have any analyses eligible for a cover letter yet. Analyze a resume first, then come back here to write one."
          />
        )}

        {(phase === "details" || phase === "generating") && (
          <CoverLetterJobForm
            onSubmit={handleSubmitJob}
            defaultValues={lastJob ?? undefined}
            pending={phase === "generating"}
          />
        )}
      </div>
    </div>
  );
}
