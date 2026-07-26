import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { BillingPeriod, Plan } from "./pricing-data";

type PricingCardProps = {
  plan: Plan;
  billingPeriod: BillingPeriod;
  className?: string;
};

/**
 * One plan. Renders as an `<li>` so the two plans are announced as a list of 2.
 *
 * The featured plan is the only interactive difference in emphasis: a filled
 * CTA, heavier elevation, and — from `lg` up — a negative block margin that
 * makes the card sit slightly taller than its sibling without a transform
 * (scaling would soften the text).
 */
export function PricingCard({
  plan,
  billingPeriod,
  className,
}: PricingCardProps) {
  const price = plan.price[billingPeriod];
  const featured = plan.featured ?? false;

  return (
    <li
      className={cn(
        // `isolate` keeps the featured glow's -z-10 inside this card.
        "relative isolate flex",
        featured && "lg:-my-4",
        className,
      )}
    >
      {featured ? (
        <div
          aria-hidden="true"
          className="bg-foreground/[0.06] pointer-events-none absolute -inset-x-6 -inset-y-4 -z-10 rounded-[2rem] blur-2xl"
        />
      ) : null}

      <div
        className={cn(
          "relative flex h-full w-full flex-col rounded-2xl border p-6 backdrop-blur-md sm:p-8",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-xl",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          featured
            ? "border-foreground/20 bg-background/80 hover:border-foreground/30 shadow-lg"
            : "border-border/60 bg-background/60 hover:border-border shadow-sm",
        )}
      >
        {plan.badge ? (
          <span className="border-border/60 bg-background text-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap shadow-sm">
            {plan.badge}
          </span>
        ) : null}

        <h3 className="text-foreground text-lg font-semibold tracking-tight">
          {plan.name}
        </h3>

        {/*
          Announced on change so switching the billing toggle is perceivable
          without sight. Only the plans whose price actually changes speak.
        */}
        <p aria-live="polite" className="mt-4 flex items-baseline gap-2">
          <span className="text-foreground text-4xl font-semibold tracking-tight tabular-nums">
            {price.amount}
          </span>
          <span className="text-muted-foreground text-sm">{price.period}</span>
        </p>

        {plan.trial ? (
          <p className="text-muted-foreground mt-2 text-sm">{plan.trial}</p>
        ) : null}

        <ul
          aria-label={`${plan.name} plan includes`}
          className="mt-8 flex flex-1 flex-col gap-3"
        >
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <Check
                aria-hidden="true"
                className="text-foreground mt-0.5 size-4 shrink-0"
              />
              <span className="text-muted-foreground leading-relaxed">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        <Button
          asChild
          size="lg"
          variant={featured ? "default" : "outline"}
          className="mt-8 h-11 w-full px-6"
        >
          <Link href={plan.cta.href}>{plan.cta.label}</Link>
        </Button>

        {plan.note ? (
          <p className="text-muted-foreground mt-3 text-center text-xs">
            {plan.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}
