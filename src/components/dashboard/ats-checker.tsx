"use client";

import * as React from "react";

import { auditResume, type AtsAuditResult } from "./ats-audit-action";
import { AtsAuditResults } from "./ats-audit-results";
import { DashboardPanel } from "./dashboard-panel";
import { ResumePicker, type SelectableAnalysis } from "./resume-picker";

type Phase = "select" | "auditing" | "results";

type AtsCheckerProps = {
  analyses: SelectableAnalysis[];
};

/**
 * Owns the select -> auditing -> results flow and the Server Action call.
 * Structurally the same pattern as `ResumeOptimizer` — an analysis picker
 * feeding a Server Action — with one addition: an already-audited analysis
 * comes back from the database instead of the model, so `onRefresh` is what
 * forces a new audit.
 */
export function AtsChecker({ analyses }: AtsCheckerProps) {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [result, setResult] = React.useState<AtsAuditResult | null>(null);
  const [auditError, setAuditError] = React.useState<string | null>(null);

  // Kept so "Run a fresh audit" knows what to re-audit without re-selecting.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const runAudit = async (analysisId: string, refresh: boolean) => {
    setAuditError(null);
    setSelectedId(analysisId);
    setPhase("auditing");

    const response = await auditResume(analysisId, refresh);

    if ("error" in response) {
      setAuditError(response.error);
      setPhase("select");
      return;
    }

    setResult(response.data);
    setPhase("results");
  };

  const reset = () => {
    setResult(null);
    setAuditError(null);
    setSelectedId(null);
    setPhase("select");
  };

  if (phase === "results" && result) {
    return (
      <AtsAuditResults
        audit={result.audit}
        atsScore={result.atsScore}
        fileName={result.fileName}
        persisted={result.persisted}
        onReset={reset}
        onRefresh={() => {
          if (selectedId) {
            void runAudit(selectedId, true);
          }
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed text-pretty">
        Pick a previous analysis for a detailed breakdown of how it holds up to
        automated screening.
      </p>

      {auditError && (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {auditError}
        </p>
      )}

      <div className="mt-7 w-full">
        {phase === "auditing" ? (
          <DashboardPanel className="text-center">
            <p className="text-muted-foreground text-sm">
              Auditing your resume…
            </p>
          </DashboardPanel>
        ) : (
          <ResumePicker
            analyses={analyses}
            onSelect={(id) => void runAudit(id, false)}
            emptyStateDescription="You don't have any analyses eligible for an ATS check yet. Analyze a resume first, then come back here for a detailed compatibility audit."
          />
        )}
      </div>
    </div>
  );
}
