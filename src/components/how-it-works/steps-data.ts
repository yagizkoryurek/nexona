import { Brain, Sparkles, Upload, type LucideIcon } from "lucide-react";

export type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const howItWorksContent = {
  label: "How it works",
  headline: "Three steps. About forty seconds.",
  description:
    "Upload once. Nexona does the reading and hands back the specific changes worth making.",
} as const;

export const steps: Step[] = [
  {
    icon: Upload,
    title: "Upload Your Resume",
    description: "Upload your existing résumé in PDF or DOCX format.",
  },
  {
    icon: Brain,
    title: "AI Analyzes Everything",
    description:
      "Nexona reviews structure, ATS compatibility, wording, and overall quality.",
  },
  {
    icon: Sparkles,
    title: "Get Actionable Feedback",
    description:
      "Receive prioritized improvements and rewrite suggestions in seconds.",
  },
];
