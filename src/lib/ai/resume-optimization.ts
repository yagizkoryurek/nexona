import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { z } from "zod";

import type { ResumeAnalysis } from "./resume-analysis";

// Own client instance, mirroring resume-analysis.ts rather than sharing one:
// construction is a cheap, stateless one-liner, so a shared client module
// would be an abstraction with nothing to justify it yet.
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-3.6-flash";

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

  const response = await genai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  if (!response.text) {
    throw new Error("The model did not return an optimized resume.");
  }

  return resumeOptimizationSchema.parse(JSON.parse(response.text));
}
