import {
  AlertTriangle,
  Check,
  CircleCheck,
  Info,
  Lightbulb,
  Minus,
  XCircle,
} from "lucide-react";

import { ScoreRing } from "@/components/score-ring";
import { Button } from "@/components/ui/button";
import type {
  AtsAudit,
  AtsAuditBlocker,
  AtsAuditSection,
  AtsAuditStatus,
} from "@/lib/ai/ats-audit";
import { cn } from "@/lib/utils";

import { DashboardPanel } from "./dashboard-panel";
import { ListPanel } from "./list-panel";

type AtsAuditResultsProps = {
  audit: AtsAudit;
  /** The stored analysis score. Displayed, never recomputed by this feature. */
  atsScore: number;
  fileName: string;
  /** False when the audit was generated but could not be saved. */
  persisted: boolean;
  onReset: () => void;
  onRefresh: () => void;
};

const STATUS_META: Record<
  AtsAuditStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  pass: { label: "Pass", icon: CircleCheck, className: "text-foreground" },
  warning: {
    label: "Needs work",
    icon: AlertTriangle,
    className: "text-foreground",
  },
  fail: { label: "Failing", icon: XCircle, className: "text-destructive" },
};

const SEVERITY_META: Record<
  AtsAuditBlocker["severity"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  critical: { label: "Critical", icon: XCircle },
  warning: { label: "Warning", icon: AlertTriangle },
  info: { label: "Info", icon: Info },
};

// Presentation-only ordering. The model returns findings in its own order; the
// UI decides that the worst things belong at the top.
const SEVERITY_ORDER: AtsAuditBlocker["severity"][] = [
  "critical",
  "warning",
  "info",
];
const PRIORITY_ORDER: AtsAudit["recommendations"][number]["priority"][] = [
  "high",
  "medium",
  "low",
];

function StatusBadge({ status }: { status: AtsAuditStatus }) {
  const { label, icon: Icon, className } = STATUS_META[status];

  return (
    <span className="border-border/60 text-muted-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
      <Icon className={cn("size-3.5", className)} aria-hidden="true" />
      {label}
    </span>
  );
}

function SectionPanel({ section }: { section: AtsAuditSection }) {
  return (
    <DashboardPanel className="text-left">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          {section.label}
        </h2>
        <StatusBadge status={section.status} />
      </div>

      <p className="text-foreground mt-3 text-sm leading-relaxed text-pretty">
        {section.headline}
      </p>

      {section.findings.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {section.findings.map((finding) => (
            <li key={finding} className="flex items-start gap-2.5">
              <AlertTriangle
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                {finding}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

function KeywordChips({ items, muted }: { items: string[]; muted: boolean }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((keyword) => (
        <li
          key={keyword}
          className={cn(
            "border-border/60 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {muted ? (
            <Minus className="size-3 shrink-0" aria-hidden="true" />
          ) : (
            <Check className="size-3 shrink-0" aria-hidden="true" />
          )}
          {keyword}
        </li>
      ))}
    </ul>
  );
}

/**
 * A completed ATS audit. Presentation only — `AtsChecker` owns the phase state
 * and decides when this renders.
 *
 * The score shown here is the one already stored on the analysis, labelled with
 * its provenance so it reads as the same number the Resume Analyzer reported
 * rather than a second, competing opinion. Nothing in this feature computes a
 * score.
 */
export function AtsAuditResults({
  audit,
  atsScore,
  fileName,
  persisted,
  onReset,
  onRefresh,
}: AtsAuditResultsProps) {
  const blockers = [...audit.blockers].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const recommendations = [...audit.recommendations].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <DashboardPanel>
        <div className="flex flex-col items-center gap-4">
          <ScoreRing value={atsScore} />
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              ATS Score
            </span>
            <span className="text-muted-foreground text-xs">
              from your resume analysis
            </span>
          </div>
        </div>

        <p className="text-foreground mt-6 text-center text-sm leading-relaxed text-pretty">
          {audit.executiveSummary}
        </p>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          {fileName}
        </p>
      </DashboardPanel>

      <div className="grid gap-6 sm:grid-cols-2">
        {audit.sections.map((section) => (
          <SectionPanel key={section.key} section={section} />
        ))}
      </div>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Keywords
        </h2>

        <h3 className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
          Present
        </h3>
        {audit.keywords.present.length > 0 ? (
          <KeywordChips items={audit.keywords.present} muted={false} />
        ) : (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            No role-relevant keywords were identified.
          </p>
        )}

        <h3 className="text-muted-foreground mt-6 text-xs font-medium tracking-wide uppercase">
          Missing
        </h3>
        {audit.keywords.missing.length > 0 ? (
          <KeywordChips items={audit.keywords.missing} muted />
        ) : (
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Nothing obvious is missing.
          </p>
        )}
      </DashboardPanel>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          ATS Blockers
        </h2>

        {blockers.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed text-pretty">
            No ATS blockers found — nothing here would break automated parsing.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {blockers.map((blocker) => {
              const { label, icon: Icon } = SEVERITY_META[blocker.severity];

              return (
                <li key={blocker.issue} className="flex items-start gap-2.5">
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      blocker.severity === "critical"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-foreground text-sm leading-relaxed text-pretty">
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {label}
                      </span>
                      <span className="mt-1 block font-medium">
                        {blocker.issue}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                      {blocker.impact}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardPanel>

      <ListPanel
        title="Missing Sections"
        items={audit.missingSections}
        icon={Minus}
        iconClassName="text-muted-foreground"
        emptyMessage="Every standard resume section is present."
      />

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Recommendations
        </h2>

        <ul className="mt-4 flex flex-col gap-4">
          {recommendations.map((recommendation) => (
            <li
              key={recommendation.action}
              className="flex items-start gap-2.5"
            >
              <Lightbulb
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {recommendation.priority} priority
                </p>
                <p className="text-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {recommendation.action}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {recommendation.rationale}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>

      {!persisted && (
        <p className="text-muted-foreground text-center text-xs" role="status">
          This audit couldn&apos;t be saved, so it won&apos;t be here next time.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onReset}
          className="h-11 px-6"
        >
          Check another resume
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onRefresh}
          className="h-11 px-6"
        >
          Run a fresh audit
        </Button>
      </div>
    </div>
  );
}
