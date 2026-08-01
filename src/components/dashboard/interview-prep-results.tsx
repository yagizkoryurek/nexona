import { MessagesSquare, Sparkles, Target } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type {
  InterviewPrep,
  InterviewPreparationFocus,
  InterviewQuestion,
  InterviewQuestionCategory,
} from "@/lib/ai/interview-prep";
import { cn } from "@/lib/utils";

import { DashboardPanel } from "./dashboard-panel";

type InterviewPrepResultsProps = {
  prep: InterviewPrep;
  fileName: string;
  /** False when the preparation was generated but could not be saved. */
  persisted: boolean;
  onReset: () => void;
  onRegenerate: () => void;
};

const CATEGORY_META: Record<InterviewQuestionCategory, { label: string }> = {
  behavioral: { label: "Behavioral" },
  technical: { label: "Technical" },
  experience: { label: "Experience" },
  resumeProbe: { label: "Resume probe" },
};

/**
 * Presentation-only ordering, same convention as `AtsAuditResults` and
 * `CareerInsightsResults`: the model returns its own order, the UI decides
 * the running order.
 *
 * `resumeProbe` sits last on purpose. Those are the uncomfortable questions —
 * gaps, short tenures, transitions — and opening a practice set with them
 * reads as an accusation. Working through the answerable material first and
 * arriving at them is the order a person would actually rehearse in.
 */
const CATEGORY_ORDER: InterviewQuestionCategory[] = [
  "experience",
  "technical",
  "behavioral",
  "resumeProbe",
];

const PRIORITY_ORDER: InterviewPreparationFocus["priority"][] = [
  "high",
  "medium",
  "low",
];

function CategoryBadge({ category }: { category: InterviewQuestionCategory }) {
  return (
    <span
      className={cn(
        "border-border/60 text-muted-foreground inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs",
      )}
    >
      {CATEGORY_META[category].label}
    </span>
  );
}

function QuestionItem({
  question,
  index,
}: {
  question: InterviewQuestion;
  index: number;
}) {
  return (
    <AccordionItem
      // Index-based rather than the question text: two questions could
      // legitimately share wording, and a duplicate value would make Radix
      // open both at once.
      value={`question-${index}`}
      className={cn(
        "border-border/60 bg-background/60 rounded-xl border shadow-sm backdrop-blur-sm",
        "hover:border-border transition-colors duration-300 ease-out",
        "motion-reduce:transition-none",
      )}
    >
      {/*
        `hover:no-underline` overrides the primitive's default, same reasoning
        as `FaqItem`: the trigger spans the whole card, and underlining a
        full-width question reads as a link.
      */}
      <AccordionTrigger className="gap-3 rounded-xl px-5 py-4 text-left hover:no-underline sm:px-6">
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <CategoryBadge category={question.category} />
          <span className="text-foreground text-sm leading-relaxed text-pretty">
            {question.question}
          </span>
        </span>
      </AccordionTrigger>

      <AccordionContent className="px-5 pb-5 sm:px-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Why you&apos;re being asked
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
          {question.whyAsked}
        </p>

        <p className="text-muted-foreground mt-4 text-xs font-medium tracking-wide uppercase">
          How to answer
        </p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
          {question.answerGuidance}
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * A completed interview preparation set. Presentation only —
 * `InterviewPrepGenerator` owns the phase state and decides when this renders.
 *
 * The questions use an accordion rather than a flat list: six to twelve
 * questions, each carrying a rationale and answer guidance, is far more text
 * than any other results view in this dashboard, and a flat list produces a
 * page nobody reads to the bottom of. `type="multiple"` rather than the FAQ's
 * `"single"` — someone rehearsing wants to compare answers side by side, not
 * have each question close the last one.
 *
 * Deliberately no `ScoreRing` and no number anywhere. This tool is never even
 * shown the stored scores (see `requestInterviewPrep`), so there is nothing to
 * display and nothing to explain.
 */
export function InterviewPrepResults({
  prep,
  fileName,
  persisted,
  onReset,
  onRegenerate,
}: InterviewPrepResultsProps) {
  const questions = [...prep.questions].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  const preparationFocus = [...prep.preparationFocus].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <DashboardPanel>
        <div className="flex flex-col items-center gap-3">
          <MessagesSquare
            aria-hidden="true"
            className="text-muted-foreground size-6"
          />
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            How You&apos;ll Come Across
          </h2>
        </div>

        <p className="text-foreground mt-4 text-center text-sm leading-relaxed text-pretty">
          {prep.overview}
        </p>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          {fileName}
        </p>
      </DashboardPanel>

      <section className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Questions to Expect
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {questions.length} questions this resume invites. Open one to see why
          it&apos;s coming and how to answer it.
        </p>

        <Accordion type="multiple" className="mt-4 gap-3">
          {questions.map((question, index) => (
            <QuestionItem
              key={`${question.category}-${index}`}
              question={question}
              index={index}
            />
          ))}
        </Accordion>
      </section>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Talking Points
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Worth raising even if nobody asks.
        </p>

        <ul className="mt-4 flex flex-col gap-4">
          {prep.talkingPoints.map((talkingPoint) => (
            <li key={talkingPoint.point} className="flex items-start gap-2.5">
              <Sparkles
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-foreground text-sm leading-relaxed font-medium text-pretty">
                  {talkingPoint.point}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {talkingPoint.evidence}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>

      <DashboardPanel className="text-left">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          What to Rehearse
        </h2>

        <ul className="mt-4 flex flex-col gap-4">
          {preparationFocus.map((focus) => (
            <li key={focus.area} className="flex items-start gap-2.5">
              <Target
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {focus.priority} priority
                </p>
                <p className="text-foreground mt-1 text-sm leading-relaxed font-medium text-pretty">
                  {focus.area}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty">
                  {focus.rationale}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </DashboardPanel>

      {!persisted && (
        <p className="text-muted-foreground text-center text-xs" role="status">
          This preparation couldn&apos;t be saved, so it won&apos;t be here next
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
          className="h-11 px-6"
        >
          Generate again
        </Button>
      </div>
    </div>
  );
}
