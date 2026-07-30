import { cn } from "@/lib/utils";

import { DashboardPanel } from "./dashboard-panel";

type ListPanelProps = {
  title: string;
  items: string[];
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  /**
   * Rendered instead of the list when `items` is empty. The analysis lists are
   * always populated, but an ATS audit's absent findings are its best possible
   * result — "No ATS blockers found" has to read as an answer, not a blank.
   */
  emptyMessage?: string;
};

/**
 * A titled list of short strings. Shared by the analysis results and the ATS
 * audit, which between them render seven of these.
 */
export function ListPanel({
  title,
  items,
  icon: Icon,
  iconClassName,
  emptyMessage,
}: ListPanelProps) {
  return (
    <DashboardPanel className="text-left">
      <h2 className="text-foreground text-base font-semibold tracking-tight">
        {title}
      </h2>

      {items.length === 0 && emptyMessage ? (
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed text-pretty">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", iconClassName)} />
              <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
