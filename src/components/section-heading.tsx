import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  /** Small eyebrow label above the headline. */
  label: string;
  headline: string;
  description?: string;
  /** Wires the parent `<section aria-labelledby>` to this heading. */
  headingId?: string;
  className?: string;
};

/**
 * Centered section header: eyebrow label, headline, supporting description.
 *
 * Lives outside the per-section folders because every landing page section
 * shares this exact block — later sections should consume it rather than
 * re-implementing the type scale.
 */
export function SectionHeading({
  label,
  headline,
  description,
  headingId,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      <h2
        id={headingId}
        className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {headline}
      </h2>
      {description ? (
        <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}
