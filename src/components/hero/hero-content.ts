/**
 * Hero copy, kept out of the markup so wording can be revised without touching
 * layout. Text is taken from the Landing Page reference.
 *
 * NOTE: `primaryCta.href` intentionally matches the navbar's "Get Started"
 * destination. If more sections start linking there, these should be hoisted
 * into a single shared route constant.
 */
export const heroContent = {
  badge: "A second opinion that has read ten thousand résumés",
  headline: "Know exactly why you're not getting interviews.",
  description:
    "You'll know more about your application in a minute than in the last fifty rejections.",
  primaryCta: { label: "Get Started", href: "/get-started" },
  secondaryCta: { label: "Watch Demo", href: "#demo" },
  trustSignals: ["No credit card required", "Results in about forty seconds"],
} as const;
