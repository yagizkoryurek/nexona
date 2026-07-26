import { SectionHeading } from "@/components/section-heading";

import { FeatureCard } from "./feature-card";
import { features, featuresContent } from "./features-data";

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      // scroll-mt clears the sticky navbar when the #features anchor is used.
      className="scroll-mt-16 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          headingId="features-heading"
          label={featuresContent.label}
          headline={featuresContent.headline}
          description={featuresContent.description}
        />

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:mt-16 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </ul>
      </div>
    </section>
  );
}
