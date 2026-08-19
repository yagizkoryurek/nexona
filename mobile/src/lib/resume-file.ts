/**
 * Client-side résumé file rules, mirroring the web app's `src/lib/resume-file.ts`.
 *
 * Duplicated rather than imported: the two projects have separate tsconfigs and
 * the root one excludes `mobile/`, so there is no shared module graph to import
 * across. This is the same choice `lib/auth-validation.ts` already makes for the
 * web's Zod auth schemas — keep the rules identical by hand, and keep them small
 * enough that staying in sync is realistic.
 *
 * Like the web, this is a convenience check only. The real boundary is
 * `/api/mobile/resume-analyzer`, which re-runs `validateResumeFile` server-side
 * on every request regardless of what the client did.
 */

export const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const;

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

type ResumeFileValidation = { ok: true } | { ok: false; error: string };

/**
 * Takes just the name and size rather than a whole picker asset, so it stays
 * usable regardless of which platform's branch of `DocumentPickerAsset` is in
 * hand — `size` is optional on that type and absent in some cases.
 *
 * Extension-based rather than MIME-based, same reasoning as the web: reported
 * MIME types for `.doc`/`.docx` are inconsistent and sometimes empty, so the
 * name is the only dependable signal available on the client.
 */
export function validateResumeFile(
  name: string,
  size: number | undefined
): ResumeFileValidation {
  const lowered = name.toLowerCase();
  const hasAllowedExtension = ALLOWED_RESUME_EXTENSIONS.some((extension) =>
    lowered.endsWith(extension)
  );

  if (!hasAllowedExtension) {
    return {
      ok: false,
      error: 'Please upload a PDF or Word document (.pdf, .doc, .docx).',
    };
  }

  // `size` is optional on DocumentPickerAsset. An unknown size is allowed
  // through rather than rejected — the server re-checks it, and refusing a file
  // the picker simply declined to measure would block a legitimate upload.
  if (size !== undefined && size > MAX_RESUME_SIZE_BYTES) {
    return {
      ok: false,
      error: `That file is too large. The limit is ${formatFileSize(MAX_RESUME_SIZE_BYTES)}.`,
    };
  }

  return { ok: true };
}
