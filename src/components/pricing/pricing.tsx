"use client";

import { SectionHeading } from "@/components/section-heading";

import { PricingCard } from "./pricing-card";
import { defaultBillingPeriod, plans, pricingContent } from "./pricing-data";

/**
 * The billing toggle is deliberately not rendered during the Beta.
 *
 * It exists to switch a plan between monthly and yearly prices, and right now
 * no plan has two: the Beta tier is ₺0 either way and Pro has no price at all.
 * A control that changes nothing visible is a dead control, so `BillingToggle`
 * (and `billingOptions`) are left in place, unrendered, for whenever billing
 * ships. Restoring it means re-adding a `useState` and the one element.
 *
 * `"use client"` stays even though no hook is used here any more: `PricingCard`
 * renders `ui/button.tsx`, which has no `"use client"` of its own and imports
 * Radix's `Slot` — rendering it from a Server Component crashes the build with
 * `createContext is not a function`. See CLAUDE.md's Known Limitations.
 */
export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      // scroll-mt clears the sticky navbar when the #pricing anchor is used.
      className="scroll-mt-16 py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          headingId="pricing-heading"
          label={pricingContent.label}
          headline={pricingContent.headline}
          description={pricingContent.description}
        />

        {/*
          Narrower than the other section grids: two cards across the full
          max-w-6xl would read as banners rather than plans. `mt-14` also leaves
          room for each card's badge, which overhangs its card.
        */}
        <ul className="mx-auto mt-14 grid max-w-4xl grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:mt-16">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billingPeriod={defaultBillingPeriod}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
