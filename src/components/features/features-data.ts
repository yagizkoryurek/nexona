import {
  FileSearch,
  PenLine,
  ShieldCheck,
  TrendingUp,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const featuresContent = {
  label: "What you get",
  headline: "Three tools, one honest read of where you stand.",
  description:
    "Every score points back to the line that earned it, so you always know what to change next.",
} as const;

export const features: Feature[] = [
  {
    icon: FileSearch,
    title: "Resume Analysis",
    description:
      "A section-by-section read of your résumé, scored against what recruiters actually screen for.",
  },
  {
    icon: Wand2,
    title: "Resume Optimizer",
    description:
      "Concrete rewrites for the bullets holding you back — scope, outcome, and the number that proves it.",
  },
  {
    icon: PenLine,
    title: "Cover Letter Generator",
    description:
      "A first draft built from your own experience and the role you're targeting, not a template.",
  },
  {
    icon: ShieldCheck,
    title: "ATS Compatibility Check",
    description:
      "Catch the formatting, headings, and keywords that quietly break applicant tracking systems.",
  },
  {
    icon: TrendingUp,
    title: "AI Career Insights",
    description:
      "See how your experience reads against the roles you want, and which gaps are worth closing first.",
  },
  {
    icon: Zap,
    title: "Fast Results",
    description:
      "A full analysis in about forty seconds. No account setup, no waiting on a human reviewer.",
  },
];
