import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requestStructuredJson } from "./gemini";
import type { ResumeAnalysis } from "./resume-analysis";

/**
 * Which shape `interviewPrepSchema` currently describes. Stored alongside
 * every preparation row so a reader can tell what it is looking at: the shape
 * will evolve while already-shipped clients keep reading older rows.
 */
export const INTERVIEW_PREP_SCHEMA_VERSION = 1;

const questionCategorySchema = z.enum([
  "behavioral",
  "technical",
  "experience",
  "resumeProbe",
]);

const focusPrioritySchema = z.enum(["high", "medium", "low"]);

const interviewQuestionSchema = z.object({
  question: z.string().min(1),
  category: questionCategorySchema,
  /** What in *this* resume prompts the question. Keeps it from being generic. */
  whyAsked: z.string().min(1),
  /** How to approach it using the candidate's own material. */
  answerGuidance: z.string().min(1),
});

const talkingPointSchema = z.object({
  point: z.string().min(1),
  /** The resume content behind it, so the point is never a bare assertion. */
  evidence: z.string().min(1),
});

const preparationFocusSchema = z.object({
  priority: focusPrioritySchema,
  area: z.string().min(1),
  rationale: z.string().min(1),
});

/**
 * The preparation document, in the exact shape it is stored and served in.
 *
 * Same two reuse decisions as `atsAuditSchema` and `careerInsightsSchema`:
 * every value a client branches on (`category`, `priority`) is a closed enum,
 * so nothing has to parse English to pick an icon or a grouping, and the
 * document is one jsonb value every client validates with this schema rather
 * than a shape the database imposed.
 *
 * **Every array requires at least one entry**, and that is a different answer
 * to the same question the other two schemas asked, not a copy of either.
 * `atsAuditSchema` omits minimums because an empty findings list is the *good*
 * outcome there; `careerInsightsSchema` splits them, sparing only `skillGaps`
 * because it describes a deficiency. This schema has **no deficiency array at
 * all** — the uncomfortable material lives inside `questions` as a
 * `resumeProbe` category rather than as its own list. So there is nothing here
 * whose emptiness would be good news: all three arrays are the deliverable,
 * and an empty one means a failed call, not a clean bill of health.
 *
 * `questions` is deliberately *not* capped here. Count shaping belongs in the
 * Gemini response schema (see `RESPONSE_SCHEMA`); a verbose answer is not
 * invalid data, and rejecting it after the call is already paid for would turn
 * a usable result into an error.
 *
 * Notably absent: any numeric field. This tool never rates the candidate, and
 * unlike Career Insights it is not even shown the stored scores — see
 * `requestInterviewPrep`.
 */
export const interviewPrepSchema = z.object({
  overview: z.string().min(1),
  questions: z.array(interviewQuestionSchema).min(1),
  talkingPoints: z.array(talkingPointSchema).min(1),
  preparationFocus: z.array(preparationFocusSchema).min(1),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewQuestionCategory = z.infer<typeof questionCategorySchema>;
export type InterviewTalkingPoint = z.infer<typeof talkingPointSchema>;
export type InterviewPreparationFocus = z.infer<typeof preparationFocusSchema>;

const SYSTEM_PROMPT = `You are an experienced interviewer preparing a candidate for interviews. You are given a candidate's actual resume text and a prior review of it. Produce the interview that this resume implies: the questions it invites, why each one is coming, and how the candidate should answer using their own material.

Your subject is the interview, not the resume as a document. Formatting, layout, section ordering, and applicant tracking compatibility are out of scope — other tools cover those. Never advise the candidate to change their resume.

Ground every question in this resume's actual content. The whyAsked field must name the specific role, project, skill, date range, or transition that prompts the question — if you cannot point at something in the resume, do not ask the question. Every answerGuidance must direct the candidate to material already in their resume. Do not attribute an employer, title, date, credential, achievement, or skill to the candidate that is not already present in the resume text. Advice that would apply to any candidate is not useful; a question that could be asked of anyone does not belong here.

Do not produce, estimate, imply, or mention any numeric score, percentage, grade, letter, or rating for this candidate anywhere in your response. Do not state salary figures or compensation ranges. Do not name or describe a specific hiring company, team, product, or interviewer — you have not been told where the candidate is applying, and inventing one would make the preparation wrong rather than generic.

Judge category honestly and use the full range. "behavioral" is a "tell me about a time" question. "technical" probes a skill, tool, or domain the resume claims. "experience" walks through a specific role or project on the resume. "resumeProbe" is the uncomfortable one: an employment gap, a short tenure, a career change, a title regression, an unexplained transition. Do not label everything "behavioral", and produce a "resumeProbe" question only where the resume genuinely invites one — a continuous, well-explained history should yield few or none, and manufacturing an awkward question about a clean record would mislead the candidate into over-explaining something no interviewer would raise.

Write the overview last, so it reflects the questions you actually produced.`;

const QUESTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description:
        "The interview question, phrased the way an interviewer would actually say it.",
    },
    category: {
      type: Type.STRING,
      enum: ["behavioral", "technical", "experience", "resumeProbe"],
      description:
        'behavioral = "tell me about a time"; technical = probes a claimed skill or domain; experience = walks through a specific role or project; resumeProbe = a gap, short tenure, career change, or unexplained transition.',
    },
    whyAsked: {
      type: Type.STRING,
      description:
        "The specific resume content that prompts this question — name the role, project, skill, date range, or transition.",
    },
    answerGuidance: {
      type: Type.STRING,
      description:
        "How the candidate should approach the answer, drawing on material already in their resume.",
    },
  },
  required: ["question", "category", "whyAsked", "answerGuidance"],
};

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overview: {
      type: Type.STRING,
      description:
        "A short paragraph on how this candidate is likely to come across in interview and what they should lead with. No numbers, scores, ratings, or salary figures.",
    },
    questions: {
      type: Type.ARRAY,
      items: QUESTION_SCHEMA,
      // Count shaping lives here rather than in Zod: enough questions to be a
      // real practice set, few enough to actually work through in one sitting.
      minItems: "6",
      maxItems: "12",
      description:
        "Questions this resume invites, spanning the four categories rather than clustering in one.",
    },
    talkingPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          point: {
            type: Type.STRING,
            description:
              "An achievement or strength worth having ready to raise unprompted.",
          },
          evidence: {
            type: Type.STRING,
            description:
              "The specific resume content that supports it, so the candidate can cite it accurately.",
          },
        },
        required: ["point", "evidence"],
      },
      minItems: "1",
      description:
        "Material the candidate should have ready to bring up, each tied to specific resume content.",
    },
    preparationFocus: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            enum: ["high", "medium", "low"],
            description:
              "How much rehearsing this area would improve the candidate's interview performance.",
          },
          area: {
            type: Type.STRING,
            description: "A specific area to rehearse before interviewing.",
          },
          rationale: {
            type: Type.STRING,
            description:
              "Why this needs work, given what the resume shows and does not show.",
          },
        },
        required: ["priority", "area", "rationale"],
      },
      minItems: "1",
      description: "What to rehearse, most impactful first.",
    },
  },
  required: ["overview", "questions", "talkingPoints", "preparationFocus"],
  // Generation order, not serialization order — same trick as the ATS audit's
  // executiveSummary and Career Insights' positioning: the overview is
  // produced last so it is written against questions that already exist,
  // rather than committing to a framing the rest then has to justify.
  propertyOrdering: [
    "questions",
    "talkingPoints",
    "preparationFocus",
    "overview",
  ],
};

/**
 * The interview a resume implies: likely questions with the content that
 * prompts each, guidance grounded in the candidate's own material, talking
 * points, and what to rehearse. Structured output plus Zod validation, same as
 * the other AI modules — see `./gemini` for the shared call sequence.
 *
 * **The stored `overall_score` and `ats_score` are deliberately not passed**,
 * and neither are the analysis `suggestions`. This is a stricter containment
 * than Career Insights', which receives both scores as fenced read-only
 * context, and the reason is relevance rather than anchoring risk: the scores
 * measure the resume as a document, which says nothing about what a hiring
 * manager would ask, and a real interviewer has no access to them either.
 * `suggestions` are likewise about improving the document, not about the
 * interview. Every field passed is a field the model may feel obliged to use,
 * so the ones that cannot help are withheld — the same reasoning that has
 * `requestAtsAudit` withhold `ats_score`.
 *
 * What is passed — `summary`, `strengths`, and `weaknesses` — is the
 * qualitative read of the candidate. `weaknesses` earns its place: it maps
 * closely onto what an interviewer probes.
 */
export async function requestInterviewPrep(
  resumeText: string,
  analysis: Pick<ResumeAnalysis, "summary" | "strengths" | "weaknesses">,
): Promise<InterviewPrep> {
  const contents = `Candidate's resume text — this is your primary source:

${resumeText}

Prior review of this resume, for context:
- Summary: ${analysis.summary}
- Strengths: ${analysis.strengths.join("; ")}
- Weaknesses: ${analysis.weaknesses.join("; ")}

Prepare this candidate for interviews per your instructions.`;

  return requestStructuredJson({
    schema: interviewPrepSchema,
    responseSchema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_PROMPT,
    contents,
    emptyResponseError: "The model did not return interview preparation.",
  });
}
