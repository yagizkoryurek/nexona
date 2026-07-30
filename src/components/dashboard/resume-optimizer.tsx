"use client";

import * as React from "react";

import { DashboardPanel } from "./dashboard-panel";
import { ResumeOptimizationResults } from "./resume-optimization-results";
import { optimizeResume } from "./resume-optimize-action";
import { ResumePicker, type SelectableAnalysis } from "./resume-picker";

type Phase = "select" | "optimizing" | "results";

type ResumeOptimizerProps = {
  analyses: SelectableAnalysis[];
};

/**
 * Owns the select -> optimizing -> results flow and the Server Action call.
 * `ResumePicker` only ever knows about listing/selecting an analysis; this is
 * what turns a selected analysis into a generated optimization. Structurally
 * the same pattern as `ResumeAnalyzer` — a file picker there, an
 * analysis picker here.
 */
export function ResumeOptimizer({ analyses }: ResumeOptimizerProps) {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [optimizedResume, setOptimizedResume] = React.useState<string | null>(
    null,
  );
  const [optimizeError, setOptimizeError] = React.useState<string | null>(null);

  const handleSelect = async (analysisId: string) => {
    setOptimizeError(null);
    setPhase("optimizing");

    const response = await optimizeResume(analysisId);

    if ("error" in response) {
      setOptimizeError(response.error);
      setPhase("select");
      return;
    }

    setOptimizedResume(response.data.optimizedResume);
    setPhase("results");
  };

  const reset = () => {
    setOptimizedResume(null);
    setOptimizeError(null);
    setPhase("select");
  };

  if (phase === "results" && optimizedResume) {
    return (
      <ResumeOptimizationResults
        optimizedResume={optimizedResume}
        onReset={reset}
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed text-pretty">
        Pick a previous analysis and we&apos;ll generate an improved version of
        that resume.
      </p>

      {optimizeError && (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {optimizeError}
        </p>
      )}

      <div className="mt-7 w-full">
        {phase === "optimizing" ? (
          <DashboardPanel className="text-center">
            <p className="text-muted-foreground text-sm">
              Generating your optimized resume…
            </p>
          </DashboardPanel>
        ) : (
          <ResumePicker
            analyses={analyses}
            onSelect={handleSelect}
            emptyStateDescription="You don't have any analyses eligible for optimization yet. Analyze a resume first, then come back here to generate an improved version of it."
          />
        )}
      </div>
    </div>
  );
}
