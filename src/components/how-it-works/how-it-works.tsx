import { SectionHeading } from "@/components/section-heading";

import { StepCard } from "./step-card";
import { howItWorksContent, steps } from "./steps-data";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      // scroll-mt clears the sticky navbar when the #how-it-works anchor is used.
      className="scroll-mt-16 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          headingId="how-it-works-heading"
          label={howItWorksContent.label}
          headline={howItWorksContent.headline}
          description={howItWorksContent.description}
        />

        {/*
          An ordered list: the sequence is meaningful, so assistive tech should
          announce these as steps 1–3 rather than an unordered set.
          `gap-6` is load-bearing — StepConnector's offsets are derived from it.
        */}
        <ol className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3 lg:mt-16">
          {steps.map((step, index) => (
            <StepCard
              key={step.title}
              {...step}
              index={index}
              showConnector={index < steps.length - 1}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
