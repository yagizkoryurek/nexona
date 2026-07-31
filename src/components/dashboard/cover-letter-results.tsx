import { Button } from "@/components/ui/button";

import { DashboardPanel } from "./dashboard-panel";

type CoverLetterResultsProps = {
  letter: string;
  jobTitle: string;
  companyName: string | null;
  persisted: boolean;
  onGenerateAnother: () => void;
  onChooseDifferentResume: () => void;
};

/**
 * A completed cover letter. Presentation only — `CoverLetterGenerator` owns
 * the phase state and decides when this renders.
 *
 * Plain text, not markdown: the model is prompted to format for readability
 * with its own line breaks and greeting/closing, same reasoning as
 * `ResumeOptimizationResults` — this project has no markdown renderer to
 * justify adding for a single field.
 */
export function CoverLetterResults({
  letter,
  jobTitle,
  companyName,
  persisted,
  onGenerateAnother,
  onChooseDifferentResume,
}: CoverLetterResultsProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Cover Letter
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {companyName ? `${jobTitle} · ${companyName}` : jobTitle}
        </p>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed whitespace-pre-wrap">
          {letter}
        </p>
      </DashboardPanel>

      {!persisted && (
        <p className="text-muted-foreground text-center text-xs" role="status">
          This letter couldn&apos;t be saved, so it won&apos;t be here next
          time.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onGenerateAnother}
          className="h-11 px-6"
        >
          Generate another
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onChooseDifferentResume}
          className="h-11 px-6"
        >
          Choose a different resume
        </Button>
      </div>
    </div>
  );
}
