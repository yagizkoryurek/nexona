import { cn } from "@/lib/utils";

import { StepConnector } from "./step-connector";
import type { Step } from "./steps-data";

type StepCardProps = Step & {
  /** Zero-based position, rendered as a 1-based "Step 01" label. */
  index: number;
  /** Suppresses the trailing connector on the final step. */
  showConnector: boolean;
  className?: string;
};

/**
 * One step in the process. Presentational only — like the feature cards, there
 * is nothing to activate, so it is intentionally not focusable.
 */
export function StepCard({
  icon: Icon,
  title,
  description,
  index,
  showConnector,
  className,
}: StepCardProps) {
  return (
    <li className={cn("relative", className)}>
      <div
        className={cn(
          "border-border/60 bg-background/60 flex h-full flex-col rounded-xl border p-6 shadow-sm backdrop-blur-sm",
          "hover:border-border transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="border-border/60 bg-foreground/[0.04] text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-lg border"
          >
            <Icon className="size-5" />
          </span>
          <span className="text-muted-foreground text-xs font-medium tracking-[0.14em] tabular-nums">
            {`STEP ${String(index + 1).padStart(2, "0")}`}
          </span>
        </div>

        <h3 className="text-foreground mt-5 text-base font-semibold tracking-tight">
          {title}
        </h3>

        <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
          {description}
        </p>
      </div>

      {showConnector ? <StepConnector /> : null}
    </li>
  );
}
