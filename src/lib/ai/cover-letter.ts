import { Type, type Schema } from "@google/genai";

import {
  coverLetterSchema,
  type CoverLetter,
  type CoverLetterInput,
} from "./cover-letter-schema";
import { requestStructuredJson } from "./gemini";
import type { ResumeAnalysis } from "./resume-analysis";

// `CoverLetter` (the response shape) is safe to re-export: it's a type-only
// export, erased entirely at compile time, so it carries no runtime import of
// this module into a client bundle.
//
// `coverLetterInputSchema` and `CoverLetterInput` are deliberately NOT
// re-exported here, even though they would compile fine. This module imports
// `./gemini`, which constructs `GoogleGenAI` at module scope using a
// server-only env var — a *value* import of anything from this file (the
// input schema is a value, a `z.object(...)` used at runtime by the client
// form) drags that construction into the browser bundle. Every consumer,
// server or client, imports the input schema from `./cover-letter-schema`
// directly; re-exporting it here would recreate exactly the import path that
// caused that break.
export type { CoverLetter } from "./cover-letter-schema";

const SYSTEM_PROMPT = `You are an expert cover letter writer. You are given a candidate's actual resume text, a prior review of it (scores and specific feedback), and a job they are applying to. Write a compelling, specific cover letter for that job, grounded entirely in the resume.

Every employer, title, date, credential, skill, project, and achievement you reference must already appear — verbatim or paraphrased — in the resume text you are given. Do not introduce any professional fact, however plausible, that is not already present there. If the job description asks for experience the resume does not show, either omit that angle entirely or address it in general terms (for example, a demonstrated ability to learn new tools quickly) rather than inventing a specific instance to satisfy it.

Lead with what the review identified as this candidate's real strengths, framed toward what the job asks for. Before finalizing, check every specific claim in your draft against the resume text and remove or generalize any that don't trace back to it.

If no company name is given, address the letter generically — "the hiring team," or no named greeting at all. Never invent a company name and never use a placeholder token like [Company Name] or [Company] in the output.

Return the full cover letter as plain text, formatted for readability (a greeting, body paragraphs, a closing) — not markdown, not JSON.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    letter: {
      type: Type.STRING,
      description: "The full cover letter, as formatted plain text.",
    },
  },
  required: ["letter"],
};

/**
 * Structured output, same reasoning as the other AI modules: constraining the
 * shape is more reliable than parsing free text out of a prompt. Result is
 * still validated against `coverLetterSchema` before being trusted. See
 * `./gemini` for the shared call sequence.
 *
 * The prompt's "never invent a fact" instruction is a mitigation, not a
 * guarantee — an LLM generating persuasive prose from scratch is more prone to
 * confabulating a supporting detail than the Optimizer's rewrite-in-place task
 * is, which is why this prompt carries three enforced layers (source-of-truth
 * framing, a structural way to avoid an unsupported claim instead of
 * inventing one, and a closing self-check) rather than one instruction.
 */
export async function requestCoverLetter(
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
  job: CoverLetterInput,
): Promise<CoverLetter> {
  const contents = `Candidate's resume text:

${resumeText}

Prior review of this resume:
- Overall score: ${analysis.overallScore}/100
- ATS score: ${analysis.atsScore}/100
- Summary: ${analysis.summary}
- Strengths: ${analysis.strengths.join("; ")}
- Weaknesses: ${analysis.weaknesses.join("; ")}
- Suggestions: ${analysis.suggestions.join("; ")}

Job applying to:
- Title: ${job.jobTitle}
- Company: ${job.companyName ?? "(not given)"}
- Description: ${job.jobDescription}

Write the cover letter per your instructions.`;

  return requestStructuredJson({
    schema: coverLetterSchema,
    responseSchema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_PROMPT,
    contents,
    emptyResponseError: "The model did not return a cover letter.",
  });
}
