"use client";

import { cn } from "@/lib/utils";

import { billingOptions, type BillingPeriod } from "./pricing-data";

type BillingToggleProps = {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  className?: string;
};

/**
 * Monthly / yearly segmented control.
 *
 * Built on native radio inputs inside a `<fieldset>` rather than a hand-rolled
 * `role="radiogroup"`: arrow-key navigation, the "n of 2" announcement and the
 * grouped legend all come from the platform. The inputs are visually hidden but
 * still focusable, so the visible pill picks up focus via `peer-focus-visible`.
 */
export function BillingToggle({
  value,
  onChange,
  className,
}: BillingToggleProps) {
  return (
    <fieldset className={cn("mx-auto mt-10 w-fit", className)}>
      <legend className="sr-only">Billing period</legend>

      <div className="border-border/60 bg-background/60 flex items-center gap-1 rounded-full border p-1 shadow-sm backdrop-blur-md">
        {billingOptions.map((option) => {
          const inputId = `billing-${option.value}`;
          const selected = option.value === value;

          return (
            <div key={option.value} className="relative">
              <input
                type="radio"
                id={inputId}
                name="billing-period"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
                  "peer-focus-visible:ring-ring/50 transition-colors duration-200 ease-out peer-focus-visible:ring-3",
                  "motion-reduce:transition-none",
                  selected
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
                {option.hint ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                      selected
                        ? "bg-background/20 text-background"
                        : "bg-foreground/[0.06] text-muted-foreground",
                    )}
                  >
                    {option.hint}
                  </span>
                ) : null}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
