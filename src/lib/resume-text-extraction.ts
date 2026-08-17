type ExtractionResult =
  { ok: true; text: string } | { ok: false; error: string };

/** Below this, the "text" is more likely a scan artifact than real content. */
export const MIN_EXTRACTED_CHARACTERS = 100;

/**
 * Upper bound on extracted resume text, and the single source of truth for that
 * limit across the app and the database.
 *
 * This exists because the AI rate limiter bounds how *many* generations a user
 * may run (15 per 10 minutes, 100 per day — see lib/ai/rate-limit.ts) but says
 * nothing about how *large* each one is. Without a ceiling here, one text-dense
 * upload inside the 10 MB file cap could extract to millions of characters and
 * be replayed against all six tools, so the per-call cost is unbounded even
 * though the per-call count is not. Note the asymmetry this closes:
 * `coverLetterInputSchema` already caps a pasted job description at 10,000
 * characters, while resume text — larger and equally user-controlled — had no
 * cap at all.
 *
 * 50,000 characters is deliberately generous: the longest resume text stored in
 * production today is roughly 2,600 characters, so this is ~19x the observed
 * maximum and will not affect any real resume.
 *
 * Migration 0008 mirrors this exact number as a CHECK constraint on
 * `resume_analyses.resume_text`, which is what stops a client from bypassing
 * this check by inserting a row through PostgREST directly. The test alongside
 * this file asserts the two numbers stay equal.
 */
export const MAX_EXTRACTED_CHARACTERS = 50_000;

export async function extractResumeText(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();
  const bytes = await file.arrayBuffer();

  try {
    if (name.endsWith(".pdf")) {
      // unpdf rejects a Node Buffer at runtime and requires a plain
      // Uint8Array, even though Buffer satisfies its TypedArray type.
      return finalize(await extractPdfText(new Uint8Array(bytes)));
    }
    if (name.endsWith(".docx")) {
      return finalize(await extractDocxText(Buffer.from(bytes)));
    }
    // .doc is legacy binary Word format — no reliable pure-JS extractor exists.
    return {
      ok: false,
      error:
        "Legacy .doc files aren't supported yet — please re-save as .docx or .pdf and try again.",
    };
  } catch (error) {
    console.error("Resume text extraction failed:", error);

    return {
      ok: false,
      error:
        "We couldn't read that file. It may be corrupted or password-protected.",
    };
  }
}

/**
 * `unpdf` rather than a plain pdfjs wrapper: it ships a serverless build with
 * the worker inlined, so there is no `pdf.worker.mjs` to resolve at runtime —
 * the failure mode that makes most PDF libraries unusable on Vercel.
 *
 * Imported dynamically so the pdfjs bundle only loads when a PDF is actually
 * uploaded, matching how mammoth is loaded below.
 */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(bytes, { mergePages: true });
  return text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Applies both length bounds to extracted text.
 *
 * Exported so the bounds are directly testable without needing PDF or DOCX
 * fixtures — the check is pure string logic and shouldn't require a parser to
 * verify. Both branches are enforced here rather than at the call sites, so
 * every extraction path (the web Server Action and the mobile route handler
 * alike) gets the same treatment by construction.
 */
export function finalize(text: string): ExtractionResult {
  const trimmed = text.trim();
  if (trimmed.length < MIN_EXTRACTED_CHARACTERS) {
    return {
      ok: false,
      error:
        "We couldn't find enough text in that file — it may be a scanned image rather than a text-based document.",
    };
  }
  // Rejected rather than truncated on purpose: silently analysing the first
  // 50,000 characters would report scores and feedback for a document the user
  // never submitted, and they would have no way to know it had been cut.
  if (trimmed.length > MAX_EXTRACTED_CHARACTERS) {
    return {
      ok: false,
      error: `That file contains too much text to analyse (${trimmed.length.toLocaleString("en-US")} characters; the limit is ${MAX_EXTRACTED_CHARACTERS.toLocaleString("en-US")}). Please upload a resume rather than a longer document.`,
    };
  }
  return { ok: true, text: trimmed };
}
