type ExtractionResult =
  { ok: true; text: string } | { ok: false; error: string };

/** Below this, the "text" is more likely a scan artifact than real content. */
const MIN_EXTRACTED_CHARACTERS = 100;

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

function finalize(text: string): ExtractionResult {
  const trimmed = text.trim();
  if (trimmed.length < MIN_EXTRACTED_CHARACTERS) {
    return {
      ok: false,
      error:
        "We couldn't find enough text in that file — it may be a scanned image rather than a text-based document.",
    };
  }
  return { ok: true, text: trimmed };
}
