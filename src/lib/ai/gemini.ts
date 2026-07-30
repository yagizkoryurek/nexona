import { GoogleGenAI, type Schema } from "@google/genai";
import type { z } from "zod";

// One client for the process. Each AI module used to construct its own; the
// client holds no per-request state (unlike the Supabase server client, which
// is cookie-scoped), so a single shared instance behaves identically with one
// fewer place for the API key to be read.
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Single place to change the model. It previously lived in every AI module,
// which meant a model swap was an N-file edit.
export const MODEL = "gemini-3.6-flash";

type StructuredJsonRequest<S extends z.ZodType> = {
  /** Validated before the result is trusted. Its inferred type is returned. */
  schema: S;
  /**
   * Gemini's own `Schema` type, not raw JSON Schema — the SDK reroutes plain
   * JSON-schema objects to a different request field, so the typed form keeps
   * what's sent unambiguous.
   */
  responseSchema: Schema;
  systemInstruction: string;
  contents: string;
  /** Thrown when the model returns no text at all. Per-caller wording. */
  emptyResponseError: string;
};

/**
 * The shared shape of every AI call in this project: structured output via a
 * response schema the model must conform to, then Zod validation of what came
 * back before it is trusted. Forcing the shape is more reliable than parsing
 * free text out of a prompt, and validating afterwards means a malformed
 * response surfaces as an error rather than propagating as data.
 *
 * Callers own their own prompt, response schema, and Zod schema — only the
 * client, the model id, and this call/guard/parse sequence are shared.
 */
export async function requestStructuredJson<S extends z.ZodType>({
  schema,
  responseSchema,
  systemInstruction,
  contents,
  emptyResponseError,
}: StructuredJsonRequest<S>): Promise<z.infer<S>> {
  const response = await genai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  if (!response.text) {
    throw new Error(emptyResponseError);
  }

  // JSON.parse before schema.parse, so a truncated response surfaces as a
  // SyntaxError and a well-formed but wrong-shaped one as a ZodError. Callers
  // branch on that distinction.
  return schema.parse(JSON.parse(response.text));
}
