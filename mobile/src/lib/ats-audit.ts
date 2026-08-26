import { postJsonToApi, type ApiResult } from '@/lib/api';

/**
 * Mirrors `AtsAudit` / the `auditResume` payload in the web app's
 * `src/lib/ai/ats-audit.ts` and `src/components/dashboard/ats-audit-action.ts`.
 *
 * Declared by hand rather than imported for the same reason as
 * `lib/resume-analysis.ts` and `lib/resume-file.ts`: the root tsconfig excludes
 * `mobile/`, so there is no shared module graph. This is the response contract
 * of one HTTP endpoint, and the endpoint validates against its own Zod schema
 * before replying — so a mismatch here surfaces as a type error on this side,
 * never as bad data reaching the server.
 *
 * Two properties of that schema matter to anything rendering this, and both are
 * deliberate on the web side:
 *
 * 1. **Most arrays can legitimately be empty, and empty is the *good* outcome.**
 *    No findings, no blockers, no missing keywords means nothing is wrong. A
 *    renderer must say so rather than showing a blank panel.
 * 2. **Every value worth branching on is a closed enum**, so nothing has to
 *    parse English to pick a colour or an ordering. `key` in particular is the
 *    stable identifier — `label` is model-generated prose and must not be
 *    keyed off.
 *
 * Notably absent: any score inside the audit. The ATS score lives on the
 * analysis row and arrives as `atsScore` below; the audit explains it rather
 * than recomputing it.
 */

export type AtsAuditStatus = 'pass' | 'warning' | 'fail';

export type AtsAuditSectionKey =
  | 'formatting'
  | 'sectionStructure'
  | 'keywords'
  | 'readability';

export type AtsAuditSection = {
  key: AtsAuditSectionKey;
  label: string;
  status: AtsAuditStatus;
  headline: string;
  /** Empty means the section is clean, not that data is missing. */
  findings: string[];
};

export type AtsAuditBlocker = {
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  impact: string;
};

export type AtsAuditRecommendation = {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
};

export type AtsAudit = {
  executiveSummary: string;
  sections: AtsAuditSection[];
  keywords: {
    present: string[];
    missing: string[];
  };
  missingSections: string[];
  blockers: AtsAuditBlocker[];
  recommendations: AtsAuditRecommendation[];
};

export type AtsAuditResult = {
  audit: AtsAudit;
  /** Read off the analysis row, never recomputed. */
  atsScore: number;
  fileName: string;
  /** Whether this came from the database or from a fresh model call. */
  source: 'stored' | 'fresh';
  /** False when a fresh audit was generated but could not be saved. */
  persisted: boolean;
};

/**
 * Requests an ATS audit for one of the caller's own analyses.
 *
 * The route serves a stored audit when one exists, so re-opening a resume is
 * free and does not consume a usage slot. Pass `refresh` to force a new one;
 * each appends a row rather than replacing the last.
 */
export async function auditResume(
  analysisId: string,
  refresh = false
): Promise<ApiResult<AtsAuditResult>> {
  return postJsonToApi<AtsAuditResult>('/api/mobile/ats-checker', {
    analysisId,
    refresh,
  });
}
