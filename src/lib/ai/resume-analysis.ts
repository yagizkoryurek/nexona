import { Type, type Schema } from "@google/genai";
import { z } from "zod";

import { requestStructuredJson } from "./gemini";

export const resumeAnalysisSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  atsScore: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1),
  weaknesses: z.array(z.string().min(1)).min(1),
  suggestions: z.array(z.string().min(1)).min(1),
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;

const SYSTEM_PROMPT = `You are an expert resume reviewer and applicant tracking system (ATS) specialist. You review resumes the way an experienced recruiter and an ATS parser would, together.

Score honestly — most real resumes should land in the 40-85 range on both scores, not near the extremes. Be specific: reference the resume's actual content in strengths, weaknesses, and suggestions rather than giving generic career advice. Every weakness should have a corresponding, actionable suggestion for how to fix it.`;

// Gemini's own Schema type, not raw JSON Schema — the SDK reroutes plain
// JSON-schema objects to a different request field, so using the typed form
// keeps what's sent unambiguous.
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.INTEGER,
      minimum: 0,
      maximum: 100,
      description: "Overall resume quality, 0-100.",
    },
    atsScore: {
      type: Type.INTEGER,
      minimum: 0,
      maximum: 100,
      description:
        "How well the resume would survive automated ATS screening, 0-100.",
    },
    summary: {
      type: Type.STRING,
      description: "One sentence summarizing the overall assessment.",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "1",
      description: "Specific things this resume does well.",
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "1",
      description: "Specific problems found in this resume.",
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "1",
      description: "Specific, actionable improvements to make.",
    },
  },
  required: [
    "overallScore",
    "atsScore",
    "summary",
    "strengths",
    "weaknesses",
    "suggestions",
  ],
};

/**
 * Forces JSON-shaped output via Gemini's structured-output mode (a response
 * schema the model must conform to) rather than parsing free text out of a
 * prompt — the reliable way to get structured data back from an LLM. The
 * result is still validated against `resumeAnalysisSchema` before being
 * trusted. See `./gemini` for the shared call sequence.
 */
export async function requestResumeAnalysis(
  resumeText: string,
): Promise<ResumeAnalysis> {
  return requestStructuredJson({
    schema: resumeAnalysisSchema,
    responseSchema: RESPONSE_SCHEMA,
    systemInstruction: SYSTEM_PROMPT,
    contents: `Review this resume and return your analysis.\n\nResume text:\n\n${resumeText}`,
    emptyResponseError: "The model did not return a structured analysis.",
  });
}
