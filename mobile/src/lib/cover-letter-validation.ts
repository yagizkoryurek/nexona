import type { FieldErrors } from '@/lib/auth-validation';

/**
 * Validation rules for the cover letter job form, mirroring the web app's
 * `coverLetterInputSchema` (src/lib/ai/cover-letter-schema.ts) bound-for-bound
 * so the two clients cannot drift into accepting different input.
 *
 * Written as plain functions rather than a Zod schema for the same reason as
 * `auth-validation.ts`: `zod` is not a dependency of the mobile project, and
 * pulling one in for three field checks is not worth it. That is safe because
 * client validation is a convenience, not a trust boundary —
 * `/api/mobile/cover-letter` re-validates the same bounds server-side with the
 * schema itself.
 *
 * Keeping the numbers identical matters more here than the messages do. The
 * route answers anything it rejects with a single generic "That request
 * couldn't be processed.", so a client bound looser than the server's would
 * surface as an unexplained failure rather than as a field error. If the schema
 * changes, this file changes with it.
 */

const MAX_JOB_TITLE = 200;
const MAX_COMPANY_NAME = 200;
const MIN_JOB_DESCRIPTION = 50;
const MAX_JOB_DESCRIPTION = 10_000;

export type CoverLetterField = 'jobTitle' | 'companyName' | 'jobDescription';

/**
 * The raw field values as typed. Trimmed here before measuring, matching the
 * schema's `.trim()` — a description of 60 spaces is not 60 characters.
 */
export function validateCoverLetterJob(values: {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}): FieldErrors<CoverLetterField> {
  const errors: FieldErrors<CoverLetterField> = {};

  const jobTitle = values.jobTitle.trim();
  if (jobTitle.length === 0) {
    errors.jobTitle = 'Job title is required';
  } else if (jobTitle.length > MAX_JOB_TITLE) {
    errors.jobTitle = `Use ${MAX_JOB_TITLE} characters or fewer`;
  }

  // Optional, so an empty value is valid — only the ceiling applies.
  if (values.companyName.trim().length > MAX_COMPANY_NAME) {
    errors.companyName = `Use ${MAX_COMPANY_NAME} characters or fewer`;
  }

  const jobDescription = values.jobDescription.trim();
  if (jobDescription.length < MIN_JOB_DESCRIPTION) {
    errors.jobDescription = `Paste at least ${MIN_JOB_DESCRIPTION} characters of the job description`;
  } else if (jobDescription.length > MAX_JOB_DESCRIPTION) {
    errors.jobDescription = `Use ${MAX_JOB_DESCRIPTION.toLocaleString('en-US')} characters or fewer`;
  }

  return errors;
}
