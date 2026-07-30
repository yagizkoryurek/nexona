import Link from "next/link";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DashboardPanel } from "./dashboard-panel";

export type SelectableAnalysis = {
  id: string;
  fileName: string;
  createdAt: string;
  overallScore: number;
  atsScore: number;
  /**
   * Optional trailing marker, e.g. "Audited". Lets a tool surface per-row state
   * without the picker having to know what that state means.
   */
  annotation?: string;
};

type ResumePickerProps = {
  analyses: SelectableAnalysis[];
  onSelect: (id: string) => void;
  /** Shown when nothing is eligible. Tool-specific, so the caller owns it. */
  emptyStateDescription: string;
};

/**
 * Lists past analyses eligible for a tool that operates on an existing one —
 * those with a stored `resume_text`. Analyses from before that column existed
 * are simply absent, not shown as errors.
 *
 * Shared by the Resume Optimizer and the ATS Compatibility Check: both need
 * the same list under the same eligibility rule, and differ only in their
 * empty-state copy and whether rows carry an annotation.
 */
export function ResumePicker({
  analyses,
  onSelect,
  emptyStateDescription,
}: ResumePickerProps) {
  if (analyses.length === 0) {
    return (
      <DashboardPanel className="text-center">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {emptyStateDescription}
        </p>

        <Button asChild size="lg" className="mt-6 h-11 px-6">
          <Link href="/dashboard/resume-analyzer">Open Resume Analyzer</Link>
        </Button>
      </DashboardPanel>
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

              {analysis.annotation && (
                <span className="border-border/60 text-muted-foreground shrink-0 rounded-full border px-2.5 py-0.5 text-xs">
                  {analysis.annotation}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
