import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

import type { FaqEntry } from "./faq-data";

type FaqItemProps = FaqEntry & {
  className?: string;
};

/**
 * One question/answer row, styled as a card so the list matches the Features,
 * Steps and Pricing surfaces.
 *
 * Must render inside an `<Accordion>` — it relies on that context for its open
 * state. Everything keyboard- and ARIA-related (Enter/Space, arrow keys,
 * `aria-expanded`, `aria-controls`) comes from the shadcn/Radix primitive; the
 * only overrides here are visual.
 */
export function FaqItem({ id, question, answer, className }: FaqItemProps) {
  return (
    <AccordionItem
      value={id}
      className={cn(
        "border-border/60 bg-background/60 rounded-xl border shadow-sm backdrop-blur-sm",
        "hover:border-border transition-colors duration-300 ease-out",
        "motion-reduce:transition-none",
        className,
      )}
    >
      {/*
        `hover:no-underline` overrides the primitive's default: the trigger
        spans the whole card, and underlining a full-width question reads as a
        link. The card's border shift carries the hover instead.
      */}
      <AccordionTrigger className="rounded-xl px-5 py-4 text-base hover:no-underline sm:px-6">
        {question}
      </AccordionTrigger>

      <AccordionContent className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed text-pretty sm:px-6">
        {answer}
      </AccordionContent>
    </AccordionItem>
  );
}
