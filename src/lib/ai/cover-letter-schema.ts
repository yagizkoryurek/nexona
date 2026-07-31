import { z } from "zod";

/**
 * Pure Zod, deliberately isolated from `./cover-letter` and `./gemini`.
 *
 * `CoverLetterJobForm` (a client component) validates with
 * `coverLetterInputSchema` before submitting, which means this file gets
 * bundled for the browser. `./gemini` calls `new GoogleGenAI(...)` at module
 * scope using a server-only env var, so any module that reaches it —
 * including transitively, through a single shared import — breaks the moment
 * a client component imports anything else from that module, even a type.
 * This file must never import from `./cover-letter` or `./gemini`, directly or
 * otherwise, so the schema stays safe to import from client code.
 */
export const coverLetterInputSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  companyName: z.string().trim().max(200).optional(),
  jobDescription: z.string().trim().min(50).max(10_000),
});

export type CoverLetterInput = z.infer<typeof coverLetterInputSchema>;

export const coverLetterSchema = z.object({
  letter: z.string().min(1),
});

export type CoverLetter = z.infer<typeof coverLetterSchema>;
