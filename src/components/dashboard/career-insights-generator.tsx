"use client";

import * as React from "react";

import {
  generateCareerInsights,
  type CareerInsightsResult,
} from "./career-insights-action";
import { CareerInsightsResults } from "./career-insights-results";
import { DashboardPanel } from "./dashboard-panel";
import { ResumePicker, type SelectableAnalysis } from "./resume-picker";

type Phase = "select" | "generating" | "results";

type CareerInsightsGeneratorProps = {
  analyses: SelectableAnalysis[];
};

/**
 * Owns the select -> generating -> results flow and the Server Action call.
 *
 * Structurally the same as `AtsChecker` rather than `CoverLetterGenerator`:
 * insights are keyed to a resume alone, so there is no job-details phase, and
 * an already-generated analysis comes back from the database instead of the
 * model. `onRegenerate` is what forces a fresh call.
 */
export function CareerInsightsGenerator({
  analyses,
}: CareerInsightsGeneratorProps) {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [result, setResult] = React.useState<CareerInsightsResult | null>(null);
  const [insightsError, setInsightsError] = React.useState<string | null>(null);

  // Kept so "Generate again" knows what to regenerate without re-selecting.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Set synchronously, before `phase` leaves "results", so the results
  // view's own regenerate button disables itself on the same click rather
  // than relying solely on the phase transition (and its unmount) to land
  // first. A rapid double-click could otherwise fire two Gemini calls before
  // that unmount commits; the server-side reservation is the backstop if it
  // still does.
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const runInsights = async (analysisId: string, refresh: boolean) => {
    setInsightsError(null);
    setSelectedId(analysisId);
    if (refresh) {
      setIsRegenerating(true);
    }
    setPhase("generating");

    const response = await generateCareerInsights(analysisId, refresh);

    setIsRegenerating(false);

    if ("error" in response) {
      setInsightsError(response.error);
      setPhase("select");
      return;
    }

    setResult(response.data);
    setPhase("results");
  };

  const reset = () => {
    setResult(null);
    setInsightsError(null);
    setSelectedId(null);
    setIsRegenerating(false);
    setPhase("select");
  };

  if (phase === "results" && result) {
    return (
      <CareerInsightsResults
        insights={result.insights}
        fileName={result.fileName}
        persisted={result.persisted}
        pending={isRegenerating}
        onReset={reset}
        onRegenerate={() => {
          if (selectedId && !isRegenerating) {
            void runInsights(selectedId, true);
          }
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed text-pretty">
        Pick a previous analysis to see where your experience positions you and
        what would move you forward.
      </p>

      {insightsError && (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {insightsError}
        </p>
      )}

      <div className="mt-7 w-full">
        {phase === "generating" ? (
          <DashboardPanel className="text-center">
            <p className="text-muted-foreground text-sm">
              Reading your career profile…
            </p>
          </DashboardPanel>
        ) : (
          <ResumePicker
            analyses={analyses}
            onSelect={(id) => void runInsights(id, false)}
            emptyStateDescription="You don't have any analyses eligible for career insights yet. Analyze a resume first, then come back here to see where it positions you."
          />
        )}
      </div>
    </div>
  );
}
