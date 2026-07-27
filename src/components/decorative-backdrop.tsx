import { cn } from "@/lib/utils";

type DecorativeBackdropProps = {
  className?: string;
};

/**
 * Soft blurred washes over a hairline grid, faded out by a radial mask.
 *
 * Extracted from the Hero so the auth screens can sit on the same surface.
 * Purely decorative: hidden from assistive tech and non-interactive, so it can
 * be dropped behind any `relative isolate` container.
 */
export function DecorativeBackdrop({ className }: DecorativeBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="bg-foreground/[0.04] absolute -top-40 -left-32 size-[34rem] rounded-full blur-3xl" />
      <div className="bg-foreground/[0.05] absolute -top-24 -right-24 size-[38rem] rounded-full blur-3xl" />
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)] [background-size:64px_64px] opacity-40" />
    </div>
  );
}
