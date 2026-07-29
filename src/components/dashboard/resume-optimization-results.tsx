import { Button } from "@/components/ui/button";

type ResumeOptimizationResultsProps = {
  optimizedResume: string;
  onReset: () => void;
};

/**
 * The result of a completed optimization. Presentation only —
 * `ResumeOptimizer` owns the phase state and decides when this renders.
 *
 * Plain text, not markdown: the model is prompted to format for readability
 * with its own line breaks and headers, and this project has no markdown
 * renderer to justify adding for a single field.
 */
export function ResumeOptimizationResults({
  optimizedResume,
  onReset,
}: ResumeOptimizationResultsProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="border-border/60 bg-background/60 rounded-2xl border p-6 text-left shadow-sm backdrop-blur-md sm:p-8">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Optimized Resume
        </h2>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed whitespace-pre-wrap">
          {optimizedResume}
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onReset}
        className="h-11 w-full px-6 sm:w-auto sm:self-center"
      >
        Try another resume
      </Button>
    </div>
  );
}
