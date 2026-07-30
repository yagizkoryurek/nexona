import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requestStructuredJson } from "./gemini";
import type { ResumeAnalysis } from "./resume-analysis";

export const resumeOptimizationSchema = z.object({
  optimizedResume: z.string().min(1),
});

export type ResumeOptimization = z.infer<typeof resumeOptimizationSchema>;

const SYSTEM_PROMPT = `You are an expert resume writer. You are given a candidate's actual resume text and a prior review of it (scores and specific feedback). Rewrite the resume to address every weakness and suggestion from that review while preserving and sharpening what the review identified as strengths.

Preserve every factual detail exactly as given — employers, job titles, dates, degrees, certifications, and numbers. Only improve wording, structure, and framing. Never invent an employer, title, date, credential, or achievement that isn't already present in the original resume text.

Return the full rewritten resume as plain text, formatted for readability (clear section headers, line breaks between entries) — not markdown, not JSON.`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    optimizedResume: {
      type: Type.STRING,
      description: "The full rewritten resume, as formatted plain text.",
    },
  },
  required: ["optimizedResume"],
};

/**
 * Structured output, same reasoning as `requestResumeAnalysis`: constraining
 * the shape is more reliable than parsing free text out of a prompt. Result
 * is still validated against `resumeOptimizationSchema` before being trusted.
 * See `./gemini` for the shared call sequence.
 */
export async function requestResumeOptimization(
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
): Promise<ResumeOptimization> {
  const contents = `Original resume text:

${resumeText}

Prior review of this resume:
- Overall score: ${analysis.overallScore}/100
- ATS score: ${analysis.atsScore}/100
- Summary: ${analysis.summary}
- Strengths: ${analysis.strengths.join("; ")}
- Weaknesses: ${analysis.weaknesses.join("; ")}
- Suggestions: ${analysis.suggestions.join("; ")}

Rewrite the resume per your instructions.`;

  return requestStructuredJson({
    schema: resumeOptimizationSchema,
    responseSchema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_PROMPT,
    contents,
    emptyResponseError: "The model did not return an optimized resume.",
  });
}
