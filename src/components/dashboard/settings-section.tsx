import { cn } from "@/lib/utils";

import { DashboardPanel } from "./dashboard-panel";

type SettingsSectionProps = {
  title: string;
  /** Optional sentence under the heading explaining what the section governs. */
  description?: string;
  /**
   * `danger` tints the border and heading with the destructive token. It is a
   * tone, not a behaviour — the section decides what it renders inside.
   */
  tone?: "default" | "danger";
  children?: React.ReactNode;
  className?: string;
};

/**
 * One titled block of the Account Settings page.
 *
 * Extracted rather than repeating the heading markup four times: every section
 * on that page is a `DashboardPanel` with an `h2`, an optional lead paragraph,
 * and a body. Kept a Server Component — nothing here is interactive, so the
 * page can render its static sections without a client boundary.
 */
export function SettingsSection({
  title,
  description,
  tone = "default",
  children,
  className,
}: SettingsSectionProps) {
  const danger = tone === "danger";

  return (
    <DashboardPanel
      className={cn("text-left", danger && "border-destructive/40", className)}
    >
      <h2
        className={cn(
          "text-base font-semibold tracking-tight",
          danger ? "text-destructive" : "text-foreground",
        )}
      >
        {title}
      </h2>

      {description ? (
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
          {description}
        </p>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </DashboardPanel>
  );
}
