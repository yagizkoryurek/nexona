export type FaqEntry = {
  /**
   * Accordion item value. Also the natural anchor if FAQ deep links are ever
   * added, so treat these as stable once shipped.
   */
  id: string;
  question: string;
  answer: string;
};

/**
 * NOTE: the label and headline are placeholders — the sprint supplied the
 * questions and answers only. Revise here, not in the markup.
 */
export const faqContent = {
  label: "FAQ",
  headline: "Questions, answered.",
} as const;

export const faqs: FaqEntry[] = [
  {
    id: "pricing-free",
    question: "Is Nexona free to use?",
    answer:
      "Yes. Nexona offers a free plan with Resume Analyzer, ATS Score, and basic AI feedback. Upgrade anytime for advanced features.",
  },
  {
    id: "pro-features",
    question: "What's included in Nexona Pro?",
    answer:
      "Unlimited Resume Analysis, Resume Optimizer, Cover Letter Generator, Advanced AI Feedback, PDF Export, Priority Processing, Priority Support, and all future AI tools.",
  },
  {
    id: "cancellation",
    question: "Can I cancel my subscription anytime?",
    answer:
      "Yes. You can cancel anytime. Your Pro features remain active until the end of your billing period.",
  },
  {
    id: "data-security",
    question: "Is my resume data secure?",
    answer:
      "Absolutely. Your resume is processed securely and is never shared with third parties.",
  },
  {
    id: "file-formats",
    question: "Which file formats are supported?",
    answer: "Currently PDF. More formats will be added later.",
  },
  {
    id: "audience",
    question: "Who is Nexona for?",
    answer:
      "Students, graduates, professionals, career changers, and anyone improving their job applications.",
  },
];
