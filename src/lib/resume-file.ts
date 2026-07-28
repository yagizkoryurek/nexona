export const ALLOWED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

type ResumeFileValidation = { ok: true } | { ok: false; error: string };

/**
 * Extension-based rather than MIME-based: browsers report inconsistent (and
 * sometimes empty) `type` values for `.doc`/`.docx`, so the name is the only
 * reliable signal available client-side.
 */
export function validateResumeFile(file: File): ResumeFileValidation {
  const name = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_RESUME_EXTENSIONS.some((extension) =>
    name.endsWith(extension),
  );

  if (!hasAllowedExtension) {
    return {
      ok: false,
      error: "Please upload a PDF or Word document (.pdf, .doc, .docx).",
    };
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return {
      ok: false,
      error: `That file is too large. The limit is ${formatFileSize(MAX_RESUME_SIZE_BYTES)}.`,
    };
  }

  return { ok: true };
}
