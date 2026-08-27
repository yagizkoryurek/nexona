import { postJsonToApi, type ApiResult } from '@/lib/api';

/**
 * Mirrors the request and response of
 * `src/app/api/mobile/cover-letter/route.ts`, which in turn mirrors
 * `generateCoverLetter` and `coverLetterInputSchema` on the web side.
 *
 * Declared by hand rather than imported for the same reason as
 * `lib/resume-analysis.ts`, `lib/ats-audit.ts` and `lib/resume-optimization.ts`:
 * the root tsconfig excludes `mobile/`, so there is no shared module graph. The
 * endpoint validates against its own Zod schema before replying, so a mismatch
 * here surfaces as a type error on this side, never as bad data reaching the
 * server.
 */

/**
 * The job a letter is written for. Bounds live in
 * `lib/cover-letter-validation.ts`; this is only the shape.
 *
 * `companyName` is optional rather than nullable because that is what the
 * route's schema accepts. A blank field is sent as `undefined` — omitted from
 * the JSON body entirely — so the column stores `null` rather than an empty
 * string, and the prompt takes its documented "address the letter generically"
 * path instead of being handed a meaningless value.
 */
export type CoverLetterJob = {
  jobTitle: string;
  companyName?: string;
  jobDescription: string;
};

export type CoverLetterResult = {
  letter: string;
  jobTitle: string;
  /** Null when none was given — the route normalises a missing name to null. */
  companyName: string | null;
  /** False when the letter was generated but could not be saved. */
  persisted: boolean;
};

/**
 * Generates a cover letter for one of the caller's own analyses.
 *
 * This is the one mobile route whose body carries more than an analysis id, and
 * `job` nests rather than flattening because the route composes
 * `coverLetterInputSchema` as-is — flattening here would not match it.
 *
 * There is deliberately no `refresh` flag and no `source` in the response.
 * Unlike the ATS Check there is no stored letter to serve: a letter is keyed to
 * a job, not just a resume, so the same analysis can produce many genuinely
 * different letters. **Every call generates and appends a row**, which means
 * every call spends a rate-limit slot.
 */
export async function generateCoverLetter(
  analysisId: string,
  job: CoverLetterJob
): Promise<ApiResult<CoverLetterResult>> {
  return postJsonToApi<CoverLetterResult>('/api/mobile/cover-letter', {
    analysisId,
    job,
  });
}
