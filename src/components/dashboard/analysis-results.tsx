import { AlertTriangle, Check, Lightbulb } from "lucide-react";

import { ScoreRing } from "@/components/score-ring";
import { Button } from "@/components/ui/button";
import type { ResumeAnalysis } from "@/lib/ai/resume-analysis";

import { DashboardPanel } from "./dashboard-panel";
import { ListPanel } from "./list-panel";

type AnalysisResultsProps = {
  result: ResumeAnalysis;
  onReset: () => void;
};

/**
 * The result of a completed analysis. Presentation only — `ResumeAnalyzer`
 * owns the phase state and decides when this renders.
 */
export function AnalysisResults({ result, onReset }: AnalysisResultsProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <DashboardPanel>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing value={result.overallScore} />
              <span className="text-muted-foreground text-xs font-medium">
                Overall Score
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ScoreRing value={result.atsScore} />
              <span className="text-muted-foreground text-xs font-medium">
                ATS Score
              </span>
            </div>
          </div>
        </div>

        <p className="text-foreground mt-6 text-center text-sm leading-relaxed text-pretty">
          {result.summary}
        </p>
      </DashboardPanel>

      <div className="grid gap-6 sm:grid-cols-2">
        <ListPanel
          title="Strengths"
          items={result.strengths}
          icon={Check}
          iconClassName="text-foreground"
        />
        <ListPanel
          title="Weaknesses"
          items={result.weaknesses}
          icon={AlertTriangle}
          iconClassName="text-destructive"
        />
      </div>

      <ListPanel
        title="Suggestions"
        items={result.suggestions}
        icon={Lightbulb}
        iconClassName="text-foreground"
      />

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onReset}
        className="h-11 w-full px-6 sm:w-auto sm:self-center"
      >
        Analyze another resume
      </Button>
    </div>
  );
}
