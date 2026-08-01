"use client";

import * as React from "react";

import {
  generateInterviewPrep,
  type InterviewPrepResult,
} from "./interview-prep-action";
import { InterviewPrepResults } from "./interview-prep-results";
import { DashboardPanel } from "./dashboard-panel";
import { ResumePicker, type SelectableAnalysis } from "./resume-picker";

type Phase = "select" | "generating" | "results";

type InterviewPrepGeneratorProps = {
  analyses: SelectableAnalysis[];
};

/**
 * Owns the select -> generating -> results flow and the Server Action call.
 *
 * Structurally the same as `AtsChecker` and `CareerInsightsGenerator` rather
 * than `CoverLetterGenerator`: preparation is keyed to a resume alone, so
 * there is no job-details phase, and an already-prepared analysis comes back
 * from the database instead of the model. `onRegenerate` is what forces a
 * fresh call.
 */
export function InterviewPrepGenerator({
  analyses,
}: InterviewPrepGeneratorProps) {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [result, setResult] = React.useState<InterviewPrepResult | null>(null);
  const [prepError, setPrepError] = React.useState<string | null>(null);

  // Kept so "Generate again" knows what to regenerate without re-selecting.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const runPrep = async (analysisId: string, refresh: boolean) => {
    setPrepError(null);
    setSelectedId(analysisId);
    setPhase("generating");

    const response = await generateInterviewPrep(analysisId, refresh);

    if ("error" in response) {
      setPrepError(response.error);
      setPhase("select");
      return;
    }

    setResult(response.data);
    setPhase("results");
  };

  const reset = () => {
    setResult(null);
    setPrepError(null);
    setSelectedId(null);
    setPhase("select");
  };

  if (phase === "results" && result) {
    return (
      <InterviewPrepResults
        prep={result.prep}
        fileName={result.fileName}
        persisted={result.persisted}
        onReset={reset}
        onRegenerate={() => {
          if (selectedId) {
            void runPrep(selectedId, true);
          }
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed text-pretty">
        Pick a previous analysis to see the questions your resume invites and
        how to answer them.
      </p>

      {prepError && (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {prepError}
        </p>
      )}

      <div className="mt-7 w-full">
        {phase === "generating" ? (
          <DashboardPanel className="text-center">
            <p className="text-muted-foreground text-sm">
              Working out what they&apos;ll ask…
            </p>
          </DashboardPanel>
        ) : (
          <ResumePicker
            analyses={analyses}
            onSelect={(id) => void runPrep(id, false)}
            emptyStateDescription="You don't have any analyses eligible for interview prep yet. Analyze a resume first, then come back here to rehearse what it invites."
          />
        )}
      </div>
    </div>
  );
}
