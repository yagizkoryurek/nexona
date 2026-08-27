import { postJsonToApi, type ApiResult } from '@/lib/api';

/**
 * Mirrors `ResumeOptimization` in the web app's
 * `src/lib/ai/resume-optimization.ts`, and the response of
 * `src/app/api/mobile/resume-optimizer/route.ts`.
 *
 * Declared by hand rather than imported for the same reason as
 * `lib/resume-analysis.ts` and `lib/ats-audit.ts`: the root tsconfig excludes
 * `mobile/`, so there is no shared module graph. This is the response contract
 * of one HTTP endpoint, and the endpoint validates against its own Zod schema
 * before replying — so a mismatch here surfaces as a type error on this side,
 * never as bad data reaching the server.
 *
 * The whole shape is one string, and that is the point. The optimized resume is
 * plain text formatted by the model itself — not markdown, not JSON — so a
 * renderer needs no parser and this app needs no markdown dependency, exactly
 * as on the web.
 */
export type ResumeOptimization = {
  optimizedResume: string;
};

/**
 * Requests an optimized rewrite of one of the caller's own analyses.
 *
 * Unlike `auditResume`, this takes no `refresh` flag and the response carries
 * no `source` or `persisted`: the Optimizer stores nothing, by design (see
 * CLAUDE.md on the tool being deliberately minimal). There is no stored result
 * to serve, so **every call spends a rate-limit slot** — there is no free
 * re-open the way there is for a stored ATS audit.
 *
 * The response also carries no `fileName`. The caller already knows which
 * analysis it picked, so the screen holds that name in its own state rather
 * than the route re-sending it.
 */
export async function optimizeResume(
  analysisId: string
): Promise<ApiResult<ResumeOptimization>> {
  return postJsonToApi<ResumeOptimization>('/api/mobile/resume-optimizer', {
    analysisId,
  });
}
