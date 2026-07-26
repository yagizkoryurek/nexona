import { cn } from "@/lib/utils";

import type { Feature } from "./features-data";

type FeatureCardProps = Feature & {
  className?: string;
};

/**
 * Single feature tile. Renders as an `<li>` — the grid is a real list, so
 * assistive tech announces the feature count.
 *
 * Presentational only: there is nothing to activate, so it is deliberately not
 * focusable. Making a static card tabbable would add a keyboard stop that leads
 * nowhere.
 */
export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <li
      className={cn(
        "border-border/60 bg-background/60 flex h-full flex-col rounded-xl border p-6 shadow-sm backdrop-blur-sm",
        "hover:border-border transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="border-border/60 bg-foreground/[0.04] text-foreground inline-flex size-10 shrink-0 items-center justify-center rounded-lg border"
      >
        <Icon className="size-5" />
      </span>

      <h3 className="text-foreground mt-5 text-base font-semibold tracking-tight">
        {title}
      </h3>

      <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
        {description}
      </p>
    </li>
  );
}
