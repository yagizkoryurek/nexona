import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

export type OptimizableAnalysis = {
  id: string;
  fileName: string;
  createdAt: string;
  overallScore: number;
  atsScore: number;
};

type ResumePickerProps = {
  analyses: OptimizableAnalysis[];
  onSelect: (id: string) => void;
};

/**
 * Lists past analyses eligible for optimization — ones with a stored
 * `resume_text`. Analyses from before that column existed are simply absent
 * from this list, not shown as errors.
 */
export function ResumePicker({ analyses, onSelect }: ResumePickerProps) {
  if (analyses.length === 0) {
    return (
      <div className="border-border/60 bg-background/60 rounded-2xl border p-6 text-center shadow-sm backdrop-blur-md sm:p-8">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          You don&apos;t have any analyses eligible for optimization yet.
          Analyze a resume first, then come back here to generate an improved
          version of it.
        </p>

        <Button asChild size="lg" className="mt-6 h-11 px-6">
          <Link href="/dashboard/resume-analyzer">Open Resume Analyzer</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border/60 bg-background/60 rounded-2xl border p-2 text-left shadow-sm backdrop-blur-md sm:p-3">
      <ul className="flex flex-col gap-1">
        {analyses.map((analysis) => (
          <li key={analysis.id}>
            <button
              type="button"
              onClick={() => onSelect(analysis.id)}
              className="hover:bg-muted focus-visible:outline-ring flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <FileText
                aria-hidden="true"
                className="text-muted-foreground size-5 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-medium">
                  {analysis.fileName}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {new Date(analysis.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  Overall {analysis.overallScore} · ATS {analysis.atsScore}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
