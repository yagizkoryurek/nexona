import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requestStructuredJson } from "./gemini";

/**
 * Which shape `atsAuditSchema` currently describes. Stored alongside every
 * audit row so a reader can tell what it is looking at: the audit shape will
 * evolve while already-shipped clients keep reading older rows.
 */
export const AUDIT_SCHEMA_VERSION = 1;

const auditStatusSchema = z.enum(["pass", "warning", "fail"]);

const auditSectionKeySchema = z.enum([
  "formatting",
  "sectionStructure",
  "keywords",
  "readability",
]);

const auditSectionSchema = z.object({
  /** Stable machine identifier. Clients key icons and colours off this. */
  key: auditSectionKeySchema,
  /** Display title, used as a fallback by a client that doesn't know `key`. */
  label: z.string().min(1),
  status: auditStatusSchema,
  headline: z.string().min(1),
  /**
   * Deliberately no `.min(1)`: a clean section legitimately has no findings,
   * and requiring one would pressure the model into inventing a problem.
   */
  findings: z.array(z.string().min(1)),
});

/**
 * The audit document, in the exact shape it is stored and served in.
 *
 * Two decisions here are about reuse across clients rather than about this
 * web app:
 *
 * 1. `sections` is an array keyed by a stable enum, not four named fields.
 *    An independently-deployed client can iterate and render any section
 *    generically — including a `key` added after that client shipped, falling
 *    back to `label` for its title. Named fields would make every new section
 *    a change in every client.
 * 2. Every value a client branches on (`status`, `severity`, `priority`) is a
 *    closed enum, so nothing has to parse English to pick an icon or colour.
 *
 * Notably absent: any score. The ATS score lives on `resume_analyses` and is
 * the single source of truth; this audit explains it rather than recomputing
 * it, so a second number here would only ever contradict the first.
 */
export const atsAuditSchema = z.object({
  executiveSummary: z.string().min(1),
  sections: z.array(auditSectionSchema).min(1),
  keywords: z.object({
    present: z.array(z.string().min(1)),
    missing: z.array(z.string().min(1)),
  }),
  // Empty arrays below are valid and are the *good* outcome — no minimums.
  missingSections: z.array(z.string().min(1)),
  blockers: z.array(
    z.object({
      severity: z.enum(["critical", "warning", "info"]),
      issue: z.string().min(1),
      impact: z.string().min(1),
    }),
  ),
  recommendations: z.array(
    z.object({
      priority: z.enum(["high", "medium", "low"]),
      action: z.string().min(1),
      rationale: z.string().min(1),
    }),
  ),
});

export type AtsAudit = z.infer<typeof atsAuditSchema>;
export type AtsAuditSection = z.infer<typeof auditSectionSchema>;
export type AtsAuditStatus = z.infer<typeof auditStatusSchema>;
export type AtsAuditBlocker = AtsAudit["blockers"][number];
export type AtsAuditRecommendation = AtsAudit["recommendations"][number];

const SYSTEM_PROMPT = `You are an applicant tracking system (ATS) specialist. You audit a resume for machine readability and explain, in specifics, how it would fare in automated screening.

Do not score the resume. Do not produce, estimate, imply, or mention any numeric score, percentage, grade, letter, or rating anywhere in your response. A score for this resume already exists and is shown to the user alongside your audit; a second number from you would only contradict it. Your job is to explain what helps and what hurts, not to rate.

Audit exactly these four sections, once each: formatting (layout, columns, tables, graphics, headers/footers, fonts), sectionStructure (presence, naming, and ordering of standard sections), keywords (role-relevant terms and skills an ATS would match on), readability (parseability of dates, bullets, contact details, and phrasing).

Ground every finding in this resume's actual content — quote or name the specific element you mean. Generic advice that would apply to any resume is not useful.

Report only real problems. If a section is genuinely clean, mark its status "pass" and return an empty findings list. Return an empty array for blockers, for missingSections, and for missing keywords when there is genuinely nothing to report — never invent a problem to fill a field. An "ATS blocker" means something that would actively break or badly degrade automated parsing, not merely a weakness.

Write the executive summary last, so it reflects what you actually found.`;

const SECTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    key: {
      type: Type.STRING,
      enum: ["formatting", "sectionStructure", "keywords", "readability"],
      description: "Which of the four audit areas this entry covers.",
    },
    label: {
      type: Type.STRING,
      description:
        'Short human-readable title for this area, e.g. "Formatting".',
    },
    status: {
      type: Type.STRING,
      enum: ["pass", "warning", "fail"],
      description:
        "pass = no issues found; warning = issues that degrade parsing; fail = issues that would likely break it.",
    },
    headline: {
      type: Type.STRING,
      description: "One sentence summarizing this area's verdict.",
    },
    findings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Specific problems found in this area, each referencing the resume's actual content. Empty when status is pass.",
    },
  },
  required: ["key", "label", "status", "headline", "findings"],
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description:
        "A short paragraph on this resume's ATS compatibility overall. No numbers, scores, or ratings.",
    },
    sections: {
      type: Type.ARRAY,
      items: SECTION_SCHEMA,
      minItems: "4",
      maxItems: "4",
      description:
        "One entry per audit area: formatting, sectionStructure, keywords, readability.",
    },
    keywords: {
      type: Type.OBJECT,
      properties: {
        present: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "Role-relevant keywords and skills the resume already contains.",
        },
        missing: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            "Role-relevant keywords an ATS would likely screen for that the resume lacks. Empty if none.",
        },
      },
      required: ["present", "missing"],
    },
    missingSections: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Standard resume sections absent from this resume. Empty if none are missing.",
    },
    blockers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          severity: {
            type: Type.STRING,
            enum: ["critical", "warning", "info"],
            description: "How badly this would affect automated parsing.",
          },
          issue: {
            type: Type.STRING,
            description: "The specific element that would break parsing.",
          },
          impact: {
            type: Type.STRING,
            description: "What an ATS would do wrong as a result.",
          },
        },
        required: ["severity", "issue", "impact"],
      },
      description:
        "Things that would actively break or badly degrade ATS parsing. Empty if there are none.",
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
            description: "How much this would improve ATS compatibility.",
          },
          action: {
            type: Type.STRING,
            description: "A specific, concrete change to make.",
          },
          rationale: {
            type: Type.STRING,
            description: "Why this helps automated screening.",
          },
        },
        required: ["priority", "action", "rationale"],
      },
      minItems: "1",
      description: "Actionable changes, most impactful first.",
    },
  },
  required: [
    "executiveSummary",
    "sections",
    "keywords",
    "missingSections",
    "blockers",
    "recommendations",
  ],
  // Generation order, not serialization order: the summary is produced last so
  // it is written against findings that already exist rather than committing
  // to a verdict the rest of the audit then has to justify.
  propertyOrdering: [
    "sections",
    "keywords",
    "missingSections",
    "blockers",
    "recommendations",
    "executiveSummary",
  ],
};

/**
 * A detailed, qualitative ATS audit of a resume. Structured output plus Zod
 * validation, same as the other AI modules — see `./gemini` for the shared
 * call sequence.
 *
 * The stored ATS score is deliberately not passed in. Showing the model a
 * number to explain would anchor its narrative to that number, which is
 * re-deriving the score by another route; the audit stands on the resume text
 * alone and the score is displayed beside it by the UI.
 */
export async function requestAtsAudit(resumeText: string): Promise<AtsAudit> {
  return requestStructuredJson({
    schema: atsAuditSchema,
    responseSchema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_PROMPT,
    contents: `Audit this resume for ATS compatibility.\n\nResume text:\n\n${resumeText}`,
    emptyResponseError: "The model did not return an ATS audit.",
  });
}
