import type { Metadata } from "next";

import { ResumeAnalyzer } from "@/components/dashboard/resume-analyzer";

export const metadata: Metadata = {
  title: "Resume Analyzer",
};

// Resume analysis (text extraction + an LLM call) can run long; raise the
// default serverless function timeout for the route whose Server Action does
// that work. Confirm your hosting plan actually honors this — e.g. Vercel's
// Hobby tier caps at 10s regardless.
export const maxDuration = 60;

export default function ResumeAnalyzerPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Resume Analyzer
      </h1>

      <div className="mt-7 w-full">
        <ResumeAnalyzer />
      </div>
    </div>
  );
}
