"use client";

import { useState } from "react";

import { SectionHeading } from "@/components/section-heading";

import { BillingToggle } from "./billing-toggle";
import { PricingCard } from "./pricing-card";
import {
  defaultBillingPeriod,
  plans,
  pricingContent,
  type BillingPeriod,
} from "./pricing-data";

export function Pricing() {
  // UI-only for now: the toggle swaps the displayed price and nothing else.
  const [billingPeriod, setBillingPeriod] =
    useState<BillingPeriod>(defaultBillingPeriod);

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

        <BillingToggle value={billingPeriod} onChange={setBillingPeriod} />

        {/*
          Narrower than the other section grids: two cards across the full
          max-w-6xl would read as banners rather than plans. `mt-14` also leaves
          room for the "Most Popular" badge, which overhangs its card.
        */}
        <ul className="mx-auto mt-14 grid max-w-4xl grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:mt-16">
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billingPeriod={billingPeriod}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
