import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requestStructuredJson } from "./gemini";
import type { ResumeAnalysis } from "./resume-analysis";

/**
 * Which shape `careerInsightsSchema` currently describes. Stored alongside
 * every insights row so a reader can tell what it is looking at: the shape
 * will evolve while already-shipped clients keep reading older rows.
 */
export const CAREER_INSIGHTS_SCHEMA_VERSION = 1;

const roleFitSchema = z.enum(["strong", "possible", "stretch"]);
const gapImpactSchema = z.enum(["high", "medium", "low"]);
const stepPrioritySchema = z.enum(["high", "medium", "low"]);

const strengthThemeSchema = z.object({
  theme: z.string().min(1),
  /** What in the resume supports this. Keeps a theme from being an assertion. */
  evidence: z.string().min(1),
});

const suitableRoleSchema = z.object({
  title: z.string().min(1),
  fit: roleFitSchema,
  rationale: z.string().min(1),
});

const skillGapSchema = z.object({
  skill: z.string().min(1),
  impact: gapImpactSchema,
  why: z.string().min(1),
});

const nextStepSchema = z.object({
  priority: stepPrioritySchema,
  action: z.string().min(1),
  rationale: z.string().min(1),
});

/**
 * The insights document, in the exact shape it is stored and served in.
 *
 * Same two reuse decisions as `atsAuditSchema`: every value a client branches
 * on (`fit`, `impact`, `priority`) is a closed enum, so nothing has to parse
 * English to pick an icon or a colour, and the document is one jsonb value
 * every client validates with this schema rather than a shape the database
 * imposed.
 *
 * The minimums are split on purpose, and the split is not the audit's rule
 * copied over. `atsAuditSchema` omits minimums because an empty findings list
 * is the *good* outcome there — requiring an entry would pressure the model
 * into inventing a problem. Here:
 *
 * - `strengthThemes`, `suitableRoles` and `nextSteps` describe what the resume
 *   already shows. They are the deliverable; an empty one is a failed call,
 *   not a clean bill of health, so each requires at least one entry.
 * - `skillGaps` describes a deficiency. A genuinely strong profile may have
 *   none worth naming, and requiring one would pressure the model into
 *   inventing a weakness — so it has no minimum, exactly like the audit's
 *   `blockers`.
 *
 * Notably absent: any numeric field. Career Insights is shown the stored
 * scores as read-only context, but it never rates the candidate — there is
 * nowhere here for a score to land even if the prompt's containment failed.
 */
export const careerInsightsSchema = z.object({
  positioning: z.string().min(1),
  strengthThemes: z.array(strengthThemeSchema).min(1),
  suitableRoles: z.array(suitableRoleSchema).min(1),
  skillGaps: z.array(skillGapSchema),
  nextSteps: z.array(nextStepSchema).min(1),
});

export type CareerInsights = z.infer<typeof careerInsightsSchema>;
export type CareerStrengthTheme = z.infer<typeof strengthThemeSchema>;
export type CareerSuitableRole = z.infer<typeof suitableRoleSchema>;
export type CareerSkillGap = z.infer<typeof skillGapSchema>;
export type CareerNextStep = z.infer<typeof nextStepSchema>;
export type CareerRoleFit = z.infer<typeof roleFitSchema>;

const SYSTEM_PROMPT = `You are an experienced career advisor. You are given a candidate's actual resume text and a prior review of that resume. Assess the candidate's current professional profile: how it reads to someone hiring, which roles it already supports, what is missing, and what to do next.

Your subject is the candidate's career position, not the quality of the resume as a document. Formatting, layout, and wording are out of scope — other tools cover those.

The prior review's overall score and ATS score are provided only as contextual information from a previous analysis. Do not reinterpret them, do not explain them, do not generate new scores based on them, and do not let them dominate your reasoning. Your conclusions must come primarily from the resume text itself.

Do not produce, estimate, imply, or mention any numeric score, percentage, grade, letter, or rating for this candidate anywhere in your response. Do not state salary figures, compensation ranges, hiring demand statistics, or market data of any kind — you have no source for those, and an invented number reads as fact.

Ground every conclusion in what the resume actually contains — name the specific experience, skill, or credential you are reasoning from. Do not attribute an employer, title, date, credential, or achievement to the candidate that is not already present in the resume text. Advice that would apply to any candidate is not useful.

Judge role fit honestly: "strong" means the resume already demonstrates what the role needs, "possible" means it demonstrates most of it, "stretch" means it is a real reach from where the candidate is now. Do not mark everything strong.

Report only real gaps. If the profile is genuinely well-rounded, return an empty skillGaps list rather than inventing a deficiency to fill the field.

Write the positioning summary last, so it reflects what you actually concluded.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    positioning: {
      type: Type.STRING,
      description:
        "A short paragraph on how this candidate's profile reads professionally — the level and kind of work it supports, and the direction it points. No numbers, scores, ratings, or salary figures.",
    },
    strengthThemes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theme: {
            type: Type.STRING,
            description:
              "A recurring professional strength across this candidate's experience.",
          },
          evidence: {
            type: Type.STRING,
            description:
              "The specific experience, skill, or credential in the resume that demonstrates this theme.",
          },
        },
        required: ["theme", "evidence"],
      },
      minItems: "1",
      description:
        "Recurring career strengths, each tied to specific resume content.",
    },
    suitableRoles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description:
              "A role this candidate's profile supports applying to.",
          },
          fit: {
            type: Type.STRING,
            enum: ["strong", "possible", "stretch"],
            description:
              "strong = the resume already demonstrates what the role needs; possible = it demonstrates most of it; stretch = a real reach from here.",
          },
          rationale: {
            type: Type.STRING,
            description:
              "Why this profile fits that role, citing specific resume content.",
          },
        },
        required: ["title", "fit", "rationale"],
      },
      minItems: "1",
      description: "Roles this candidate is positioned for, best fit first.",
    },
    skillGaps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          skill: {
            type: Type.STRING,
            description:
              "A skill, credential, or kind of experience the profile lacks.",
          },
          impact: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
            description:
              "How much closing this gap would widen the roles available to this candidate.",
          },
          why: {
            type: Type.STRING,
            description:
              "What this gap currently closes off, given what the resume shows.",
          },
        },
        required: ["skill", "impact", "why"],
      },
      description:
        "Gaps holding this profile back. Empty if there are genuinely none worth naming.",
    },
    nextSteps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
            description:
              "How much this would move the candidate's position forward.",
          },
          action: {
            type: Type.STRING,
            description:
              "A specific, concrete step to take — a kind of project, experience, or credential to pursue.",
          },
          rationale: {
            type: Type.STRING,
            description: "What this changes about the candidate's position.",
          },
        },
        required: ["priority", "action", "rationale"],
      },
      minItems: "1",
      description: "Concrete career moves, most impactful first.",
    },
  },
  required: [
    "positioning",
    "strengthThemes",
    "suitableRoles",
    "skillGaps",
    "nextSteps",
  ],
  // Generation order, not serialization order — same trick as the ATS audit's
  // executiveSummary: positioning is produced last so it is written against
  // conclusions that already exist, rather than committing to a verdict the
  // rest of the document then has to justify.
  propertyOrdering: [
    "strengthThemes",
    "suitableRoles",
    "skillGaps",
    "nextSteps",
    "positioning",
  ],
};

/**
 * A qualitative read of a candidate's professional position. Structured output
 * plus Zod validation, same as the other AI modules — see `./gemini` for the
 * shared call sequence.
 *
 * Unlike `requestAtsAudit`, which withholds the stored `ats_score` so the model
 * cannot anchor a narrative to a number it was asked to explain, this call
 * passes both stored scores through as context. The containment is prompt-level
 * instead of structural: the scores are labelled as prior context, and the
 * system prompt forbids reinterpreting, explaining, or re-deriving them. That
 * is a mitigation, not a guarantee. The structural half is `careerInsightsSchema`
 * having no numeric field at all, so no score can be stored or rendered even if
 * the instruction is ignored in the model's prose.
 */
export async function requestCareerInsights(
  resumeText: string,
  analysis: Pick<
    ResumeAnalysis,
    | "overallScore"
    | "atsScore"
    | "summary"
    | "strengths"
    | "weaknesses"
    | "suggestions"
  >,
): Promise<CareerInsights> {
  const contents = `Candidate's resume text — this is your primary source:

${resumeText}

Prior review of this resume, for context only:
- Overall score (context only, do not reinterpret or explain): ${analysis.overallScore}/100
- ATS score (context only, do not reinterpret or explain): ${analysis.atsScore}/100
- Summary: ${analysis.summary}
- Strengths: ${analysis.strengths.join("; ")}
- Weaknesses: ${analysis.weaknesses.join("; ")}
- Suggestions: ${analysis.suggestions.join("; ")}

Assess this candidate's professional position per your instructions.`;

  return requestStructuredJson({
    schema: careerInsightsSchema,
    responseSchema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_PROMPT,
    contents,
    emptyResponseError: "The model did not return career insights.",
  });
}
