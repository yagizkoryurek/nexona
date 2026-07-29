"use client";

import * as React from "react";

import { ResumeOptimizationResults } from "./resume-optimization-results";
import { optimizeResume } from "./resume-optimize-action";
import { OptimizableAnalysis, ResumePicker } from "./resume-picker";

type Phase = "select" | "optimizing" | "results";

type ResumeOptimizerProps = {
  analyses: OptimizableAnalysis[];
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
          <div className="border-border/60 bg-background/60 rounded-2xl border p-6 text-center shadow-sm backdrop-blur-md sm:p-8">
            <p className="text-muted-foreground text-sm">
              Generating your optimized resume…
            </p>
          </div>
        ) : (
          <ResumePicker analyses={analyses} onSelect={handleSelect} />
        )}
      </div>
    </div>
  );
}
