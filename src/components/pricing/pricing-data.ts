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
  /** Pill rendered above the card, e.g. "Coming Soon". */
  badge?: string;
  /**
   * Every billing period must be covered so the toggle can never show a gap.
   * Omitted entirely for a `comingSoon` plan, which has no price to show.
   */
  price?: Record<BillingPeriod, PlanPrice>;
  /** Trial line shown under the price. */
  trial?: string;
  /**
   * Short paragraph shown in place of a price and feature list. Only used by
   * `comingSoon` plans, where listing features would promise unbuilt work.
   */
  summary?: string;
  features: string[];
  /**
   * Omitted for a `comingSoon` plan: there is nothing to click through to, and
   * a disabled button reads as a broken control rather than a future one.
   */
  cta?: { label: string; href: string };
  /** Fine print under the call to action. */
  note?: string;
  /** Emphasised plan: larger card, filled CTA, stronger elevation. */
  featured?: boolean;
  /** Announced but not purchasable: no price, no trial, no CTA. */
  comingSoon?: boolean;
};

export const pricingContent = {
  label: "Pricing",
  headline: "Free while Nexona is in Beta.",
  description:
    "Every tool is available at no cost during the public Beta. Paid plans will arrive later, once billing exists.",
} as const;

export const billingOptions: BillingOption[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly", hint: "2 months free" },
];

export const defaultBillingPeriod: BillingPeriod = "monthly";

/**
 * Prices are authored as display strings rather than numbers: there is no
 * pricing logic in the product yet. Introduce a formatter only once real prices
 * arrive from an API.
 *
 * **Every feature listed here must already work.** The Beta plan is the only
 * purchasable-equivalent tier, and it is free, so this list doubles as a claim
 * about what a new account actually gets. There is no plan gating and no rate
 * limiting anywhere in the codebase, so a signed-in user genuinely has all six
 * tools with no per-day cap — an earlier version of this file understated the
 * free tier while the Pro tier promised features (PDF export, priority
 * processing, usage limits) that do not exist. Do not reintroduce either.
 *
 * NOTE: `cta.href` matches the navbar's and hero's "Get Started" destination.
 * Three sections now point at the same route — worth hoisting into one shared
 * route constant.
 */
export const plans: Plan[] = [
  {
    id: "free",
    name: "Beta",
    badge: "Free during Beta",
    price: {
      monthly: { amount: "₺0", period: "during Beta" },
      yearly: { amount: "₺0", period: "during Beta" },
    },
    features: [
      "Resume Analyzer with overall and ATS scores",
      "Resume Optimizer",
      "ATS Compatibility Check",
      "Cover Letter Generator",
      "Career Insights",
      "Interview Preparation",
      "PDF and DOCX uploads",
    ],
    cta: { label: "Get Started", href: "/get-started" },
    featured: true,
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Coming Soon",
    summary:
      "A paid plan will follow the Beta. We haven't settled its price or what it includes, so there is nothing to sign up for yet — and we would rather say that than promise a feature list we haven't built.",
    features: [],
    comingSoon: true,
  },
];
