import { SectionHeading } from "@/components/section-heading";
import { Accordion } from "@/components/ui/accordion";

import { faqContent, faqs } from "./faq-data";
import { FaqItem } from "./faq-item";

export function FAQ() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      // scroll-mt clears the sticky navbar when the #faq anchor is used.
      className="scroll-mt-16 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          headingId="faq-heading"
          label={faqContent.label}
          headline={faqContent.headline}
        />

        {/*
          `type="single"` enforces one open item at a time; `collapsible` lets
          the open item be closed again, so the section can return to its
          initial all-closed state.
        */}
        <Accordion
          type="single"
          collapsible
          className="mx-auto mt-12 max-w-3xl gap-3 lg:mt-16"
        >
          {faqs.map((faq) => (
            <FaqItem key={faq.id} {...faq} />
          ))}
        </Accordion>
      </div>
    </section>
  );
}
