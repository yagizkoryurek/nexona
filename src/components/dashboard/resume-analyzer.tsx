"use client";

import * as React from "react";

import type { ResumeAnalysis } from "@/lib/ai/resume-analysis";

import { AnalysisResults } from "./analysis-results";
import { analyzeResume } from "./resume-analyze-action";
import { ResumeDropzone } from "./resume-dropzone";

type Phase = "select" | "analyzing" | "results";

/**
 * Owns the select -> analyzing -> results flow and the Server Action call.
 * `ResumeDropzone` only ever knows about file selection; this is what turns
 * a selected file into a stored analysis.
 */
export function ResumeAnalyzer() {
  const [phase, setPhase] = React.useState<Phase>("select");
  const [result, setResult] = React.useState<ResumeAnalysis | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);

  const handleAnalyze = async (file: File) => {
    setAnalysisError(null);
    setPhase("analyzing");

    const formData = new FormData();
    formData.append("file", file);

    const response = await analyzeResume(formData);

    if ("error" in response) {
      setAnalysisError(response.error);
      setPhase("select");
      return;
    }

    setResult(response.data);
    setPhase("results");
  };

  const reset = () => {
    setResult(null);
    setAnalysisError(null);
    setPhase("select");
  };

  if (phase === "results" && result) {
    return <AnalysisResults result={result} onReset={reset} />;
  }

  return (
    <div className="flex w-full flex-col items-center">
      <p className="text-muted-foreground max-w-md text-center text-sm leading-relaxed text-pretty">
        Add a PDF or Word document and we&apos;ll break down how it reads to a
        recruiter and an ATS.
      </p>

      <div className="mt-7 w-full">
        <ResumeDropzone
          onAnalyze={handleAnalyze}
          pending={phase === "analyzing"}
          analysisError={analysisError}
        />
      </div>
    </div>
  );
}
