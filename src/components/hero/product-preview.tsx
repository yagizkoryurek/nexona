import { cn } from "@/lib/utils";

import { ScoreRing } from "@/components/score-ring";

const OVERALL_SCORE = 78;

/** Illustrative analysis rows — static presentation data, not real output. */
const criteria = [
  { label: "Keyword match", value: 84, status: "Strong" },
  { label: "Experience framing", value: 71, status: "Review" },
  { label: "Quantified impact", value: 52, status: "Gap" },
  { label: "Formatting", value: 93, status: "Strong" },
] as const;

const statusStyles: Record<(typeof criteria)[number]["status"], string> = {
  Strong: "bg-foreground/5 text-foreground",
  Review: "bg-foreground/5 text-muted-foreground",
  Gap: "bg-destructive/10 text-destructive",
};

function CriterionRow({ label, value, status }: (typeof criteria)[number]) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground text-xs font-medium">{label}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium",
            statusStyles[status],
          )}
        >
          {status}
        </span>
      </div>
      <div className="bg-foreground/10 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-foreground h-full rounded-full"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

type ProductPreviewProps = {
  className?: string;
};

/**
 * Static glass-panel mock of the analysis dashboard.
 *
 * Exposed to assistive tech as a single labelled image: `role="img"` prunes the
 * subtree, so screen readers get one meaningful description instead of reading
 * out fabricated scores row by row.
 */
export function ProductPreview({ className }: ProductPreviewProps) {
  return (
    <div
      role="img"
      aria-label={`Preview of the Nexona résumé analysis dashboard, showing an overall match score of ${OVERALL_SCORE} out of 100 alongside per-section feedback.`}
      className={cn(
        "border-border/60 bg-background/70 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl",
        "shadow-foreground/10",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="border-border/50 bg-background/60 flex items-center gap-2 border-b px-4 py-3">
        <div className="flex gap-1.5">
          <span className="bg-foreground/15 size-2.5 rounded-full" />
          <span className="bg-foreground/15 size-2.5 rounded-full" />
          <span className="bg-foreground/15 size-2.5 rounded-full" />
        </div>
        <span className="text-muted-foreground ml-2 truncate text-xs font-medium">
          Product Analyst · Résumé analysis
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Score summary */}
        <div className="border-border/50 bg-background/60 flex items-center gap-4 rounded-xl border p-4 backdrop-blur-sm sm:gap-5">
          <ScoreRing value={OVERALL_SCORE} />
          <div className="min-w-0 space-y-1.5">
            <p className="text-foreground text-sm font-semibold">
              Strong, with two fixable gaps
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Your experience reads well. Impact statements are missing numbers
              in four of nine bullets.
            </p>
          </div>
        </div>

        {/* Per-section breakdown */}
        <div className="border-border/50 bg-background/60 space-y-3.5 rounded-xl border p-4 backdrop-blur-sm">
          {criteria.map((criterion) => (
            <CriterionRow key={criterion.label} {...criterion} />
          ))}
        </div>

        {/* Highlighted suggestion */}
        <div className="border-border/60 bg-foreground/[0.03] rounded-xl border p-4">
          <p className="text-foreground text-xs font-semibold">
            Top suggestion
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Rewrite “Led migration project” with scope and outcome — team size,
            timeline, and the measurable result.
          </p>
        </div>
      </div>
    </div>
  );
}
