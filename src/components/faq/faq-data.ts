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
      "Yes. Nexona is in public Beta and every tool is free while it lasts — résumé analysis, the optimizer, the ATS check, cover letters, career insights, and interview preparation. There is no payment step and no card required. Paid plans will come later; we have not set a price or decided what they include.",
  },
  {
    id: "beta-limits",
    question: "What does Beta mean for me?",
    answer:
      "You get the full toolkit at no cost, and in exchange you are using software that is still being finished. Things may change or briefly break, and we would rather hear about it than not — see the Contact page. Nothing you do now creates a subscription or a charge.",
  },
  {
    id: "data-security",
    question: "Is my resume data secure?",
    answer:
      "Your account and analyses are protected by row-level security, so only you can read your own data, and the file you upload is never stored — only the text extracted from it. That text is sent to a third-party AI provider for processing, which is how the analysis is produced. We do not sell it or share it for advertising. See the Privacy Policy for the full detail.",
  },
  {
    id: "file-formats",
    question: "Which file formats are supported?",
    answer:
      "PDF and DOCX, up to 10 MB. Legacy .doc files are not supported yet — re-save as .docx or PDF. A scanned résumé with no text layer cannot be read either, since there is nothing to extract.",
  },
  {
    id: "audience",
    question: "Who is Nexona for?",
    answer:
      "Students, graduates, professionals, career changers, and anyone improving their job applications.",
  },
];
