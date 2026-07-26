import { cn } from "@/lib/utils";

type AnnouncementBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Small glass pill used above the hero headline. Built from design tokens
 * rather than pulling in the shadcn Badge primitive, which would regenerate
 * design-system files for a single bespoke pill.
 */
export function AnnouncementBadge({
  children,
  className,
}: AnnouncementBadgeProps) {
  return (
    <span
      className={cn(
        "border-border/60 bg-background/60 text-muted-foreground inline-flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2.5 text-xs font-medium shadow-sm backdrop-blur-md sm:text-[0.8125rem]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-foreground/70 size-1.5 shrink-0 rounded-full"
      />
      {children}
    </span>
  );
}
