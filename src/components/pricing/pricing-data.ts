export type BillingPeriod = "monthly" | "yearly";

export type BillingOption = {
  value: BillingPeriod;
  label: string;
  /** Optional savings hint rendered beside the label. */
  hint?: string;
};

export type PlanPrice = {
  amount: string;
  period: string;
};

export type Plan = {
  id: string;
  name: string;
  /** Pill rendered above the card, e.g. "Most Popular". */
  badge?: string;
  /** Every billing period must be covered so the toggle can never show a gap. */
  price: Record<BillingPeriod, PlanPrice>;
  /** Trial line shown under the price. */
  trial?: string;
  features: string[];
  cta: { label: string; href: string };
  /** Fine print under the call to action. */
  note?: string;
  /** Emphasised plan: larger card, filled CTA, stronger elevation. */
  featured?: boolean;
};

export const pricingContent = {
  label: "Pricing",
  headline: "Simple pricing for every stage of your career.",
  description: "Start free and upgrade whenever you're ready.",
} as const;

export const billingOptions: BillingOption[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly", hint: "2 months free" },
];

export const defaultBillingPeriod: BillingPeriod = "monthly";

/**
 * Prices are authored as display strings rather than numbers: there is no
 * pricing logic in the product yet, and the yearly figure is a fixed marketing
 * number (₺349 × 10 months = ₺3.490, i.e. two months free) formatted with the
 * tr-TR thousands separator. Introduce a formatter only once real prices arrive
 * from an API.
 *
 * NOTE: `cta.href` matches the navbar's and hero's "Get Started" destination.
 * Three sections now point at the same route — worth hoisting into one shared
 * route constant.
 */
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: {
      monthly: { amount: "₺0", period: "Forever" },
      yearly: { amount: "₺0", period: "Forever" },
    },
    features: [
      "Resume Analyzer",
      "ATS Score",
      "Basic AI Feedback",
      "3 Analyses per day",
      "Email Support",
    ],
    cta: { label: "Get Started", href: "/get-started" },
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    price: {
      monthly: { amount: "₺349", period: "per month" },
      yearly: { amount: "₺3.490", period: "per year" },
    },
    trial: "7-Day Free Trial",
    features: [
      "Unlimited Resume Analysis",
      "Advanced AI Feedback",
      "Resume Optimizer",
      "Cover Letter Generator",
      "PDF Export",
      "Priority Processing",
      "Includes all future AI tools",
      "Priority Support",
    ],
    cta: { label: "Start 7-Day Free Trial", href: "/get-started" },
    note: "Cancel anytime.",
    featured: true,
  },
];
