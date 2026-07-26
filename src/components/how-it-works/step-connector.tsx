import { ArrowDown, ArrowRight } from "lucide-react";

/**
 * Decorative link between two steps: points down in the stacked mobile
 * timeline, right once the steps sit side by side.
 *
 * Offsets assume the grid's `gap-6` (24px). A 16px icon at a 20px negative
 * offset spans 4px–20px into that gap, i.e. exactly centred. Changing the grid
 * gap means changing these offsets to match.
 */
export function StepConnector() {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground/60 absolute -bottom-5 left-1/2 -translate-x-1/2 sm:top-1/2 sm:right-[-1.25rem] sm:bottom-auto sm:left-auto sm:translate-x-0 sm:-translate-y-1/2"
    >
      <ArrowDown className="size-4 sm:hidden" />
      <ArrowRight className="hidden size-4 sm:block" />
    </span>
  );
}
