import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * The dashboard's card surface. Extracted once a third tool needed it — the
 * ATS audit renders seven of these, and the class list had already been copied
 * by hand in every results view.
 *
 * Scoped to the dashboard on purpose: the same idiom appears in the auth and
 * landing surfaces, but those are laid out differently enough that folding
 * them in would mean parameterizing padding and alignment until the wrapper
 * says less than the classes it replaced.
 */
export function DashboardPanel({ children, className }: DashboardPanelProps) {
  return (
    <div
      className={cn(
        "border-border/60 bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur-md sm:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
