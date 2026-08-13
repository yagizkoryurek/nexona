import { Briefcase, Compass, Sparkles, Target, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CareerInsights,
  CareerNextStep,
  CareerRoleFit,
  CareerSkillGap,
} from "@/lib/ai/career-insights";
import { cn } from "@/lib/utils";

import { DashboardPanel } from "./dashboard-panel";

type CareerInsightsResultsProps = {
  insights: CareerInsights;
  fileName: string;
  /** False when the insights were generated but could not be saved. */
  persisted: boolean;
  /** True while a regenerate request is in flight — disables "Generate again". */
  pending: boolean;
  onReset: () => void;
  onRegenerate: () => void;
};

const FIT_META: Record<CareerRoleFit, { label: string; className: string }> = {
  strong: { label: "Strong fit", className: "text-foreground" },
  possible: { label: "Possible", className: "text-muted-foreground" },
  stretch: { label: "Stretch", className: "text-muted-foreground" },
};

// Presentation-only ordering, same convention as `AtsAuditResults`: the model
// returns its own order, the UI decides that the most actionable entries lead.
const FIT_ORDER: CareerRoleFit[] = ["strong", "possible", "stretch"];
const IMPACT_ORDER: CareerSkillGap["impact"][] = ["high", "medium", "low"];
const PRIORITY_ORDER: CareerNextStep["priority"][] = ["high", "medium", "low"];

function FitBadge({ fit }: { fit: CareerRoleFit }) {
  const { label, className } = FIT_META[fit];

  return (
    <span
      className={cn(
        "border-border/60 inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * A completed set of career insights. Presentation only —
 * `CareerInsightsGenerator` owns the phase state and decides when this renders.
 *
 * Deliberately no `ScoreRing` and no number anywhere. The stored scores are
 * context the model reasons from, not this tool's subject: re-displaying them
 * here would invite exactly the "explain the number" reading the prompt
 * forbids. The Resume Analyzer and ATS Check are where those scores belong.
 */
export function CareerInsightsResults({
  insights,
  fileName,
  persisted,
  pending,
  onReset,
  onRegenerate,
}: CareerInsightsResultsProps) {
  const suitableRoles = [...insights.suitableRoles].sort(
    (a, b) => FIT_ORDER.indexOf(a.fit) - FIT_ORDER.indexOf(b.fit),
  );
  const skillGaps = [...insights.skillGaps].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact),
  );
  const nextSteps = [...insights.nextSteps].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <DashboardPanel>
        <div className="flex flex-col items-center gap-3">
          <Compass
            aria-hidden="true"
            className="text-muted-foreground size-6"
          />
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Your Professional Position
          </h2>
        </div>

        <p className="text-foreground mt-4 text-center text-sm leading-relaxed text-pretty">
          {insights.positioning}
        </p>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          {fileName}
        </p>
      </DashboardPanel>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Strength Themes
        </h2>

        <ul className="mt-4 flex flex-col gap-4">
          {insights.strengthThemes.map((theme) => (
            <li key={theme.theme} className="flex items-start gap-2.5">
              <Sparkles
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-foreground text-sm leading-relaxed font-medium text-pretty">
                  {theme.theme}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {theme.evidence}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Roles You&apos;re Positioned For
        </h2>

        <ul className="mt-4 flex flex-col gap-4">
          {suitableRoles.map((role) => (
            <li key={role.title} className="flex items-start gap-2.5">
              <Briefcase
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-foreground text-sm leading-relaxed font-medium text-pretty">
                    {role.title}
                  </p>
                  <FitBadge fit={role.fit} />
                </div>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {role.rationale}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Skill Gaps
        </h2>

        {/*
          An empty list is a legitimate, good outcome here — `skillGaps` is the
          one array in `careerInsightsSchema` with no minimum, so this has to
          read as an answer rather than a blank panel.
        */}
        {skillGaps.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed text-pretty">
            No significant gaps stood out — this profile reads as well-rounded
            for the roles above.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {skillGaps.map((gap) => (
              <li key={gap.skill} className="flex items-start gap-2.5">
                <Target
                  aria-hidden="true"
                  className="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {gap.impact} impact
                  </p>
                  <p className="text-foreground mt-1 text-sm leading-relaxed font-medium text-pretty">
                    {gap.skill}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                    {gap.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Next Steps
        </h2>

        <ul className="mt-4 flex flex-col gap-4">
          {nextSteps.map((step) => (
            <li key={step.action} className="flex items-start gap-2.5">
              <TrendingUp
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {step.priority} priority
                </p>
                <p className="text-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {step.action}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {step.rationale}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>

      {!persisted && (
        <p className="text-muted-foreground text-center text-xs" role="status">
          These insights couldn&apos;t be saved, so they won&apos;t be here next
          time.
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
          Choose another resume
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onRegenerate}
          disabled={pending}
          className="h-11 px-6"
        >
          {pending ? "Generating…" : "Generate again"}
        </Button>
      </div>
    </div>
  );
}
