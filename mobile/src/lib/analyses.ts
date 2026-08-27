import type { ApiResult } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * Reads the caller's own resume analyses, for tools that operate on a stored
 * analysis rather than on a freshly uploaded file.
 *
 * This is the one place the app talks to a table rather than to
 * `/api/mobile/*`, and that is deliberate. The API routes exist because AI
 * generation needs `GEMINI_API_KEY`, which is server-only — a plain read of the
 * user's own rows needs no secret. Row Level Security scopes `resume_analyses`
 * and `ats_audits` to `auth.uid()`, which is exactly the policy the web
 * dashboard's picker depends on, and the session's bearer token rides on every
 * PostgREST call from this client. Proxying it through a route would add a
 * server hop to re-permit a read the client is already entitled to.
 *
 * Note there is deliberately no `user_id` filter below. RLS applies it, and
 * stating it again would imply the query is what enforces ownership.
 */

export type SelectableAnalysis = {
  id: string;
  fileName: string;
  createdAt: string;
  overallScore: number;
  atsScore: number;
  /**
   * Optional trailing marker, e.g. "Audited". Lets a tool surface per-row state
   * without the picker having to know what that state means — the same shape as
   * the web `SelectableAnalysis`'s `annotation`.
   */
  annotation?: string;
};

const GENERIC_ERROR = "We couldn't load your resumes. Please try again.";

/**
 * The eligible-analysis query every tool shares, newest first.
 *
 * Eligibility is a stored `resume_text`. Analyses created before that column
 * existed have none and are simply absent — not shown as errors, since there is
 * no backfill path and the original text was never retained.
 *
 * `resume_text` is filtered on but never selected: it is the largest column by
 * far and nothing on this side has a use for it.
 */
async function listEligibleAnalyses(): Promise<ApiResult<SelectableAnalysis[]>> {
  try {
    const { data, error } = await supabase
      .from('resume_analyses')
      .select('id, file_name, created_at, overall_score, ats_score')
      .not('resume_text', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list analyses:', error);
      return { error: GENERIC_ERROR };
    }

    return {
      data: (data ?? []).map((row) => ({
        id: row.id as string,
        fileName: row.file_name as string,
        createdAt: row.created_at as string,
        overallScore: row.overall_score as number,
        atsScore: row.ats_score as number,
      })),
    };
  } catch {
    // Network failure, DNS, timeout — same treatment as lib/api.ts gives them.
    return {
      error: "We couldn't reach Nexona. Check your connection and try again.",
    };
  }
}

/**
 * Lists analyses eligible for an ATS check, annotated with whether one already
 * exists — the marker that tells a user re-opening a resume is free.
 */
export async function listAuditableAnalyses(): Promise<
  ApiResult<SelectableAnalysis[]>
> {
  const result = await listEligibleAnalyses();
  if ('error' in result) return result;

  const auditedIds = await listAuditedAnalysisIds();

  return {
    data: result.data.map((analysis) =>
      auditedIds.has(analysis.id)
        ? { ...analysis, annotation: 'Audited' }
        : analysis
    ),
  };
}

/**
 * Lists analyses eligible for optimization.
 *
 * No annotation, and deliberately no second query: the Optimizer stores
 * nothing, so there is no prior result for a row to be marked with. Every run
 * is a fresh generation — see lib/resume-optimization.ts.
 */
export async function listOptimizableAnalyses(): Promise<
  ApiResult<SelectableAnalysis[]>
> {
  return listEligibleAnalyses();
}

/**
 * A separate query rather than a PostgREST embed: this only needs a set of ids,
 * and stays predictable without depending on relationship detection. A failure
 * here is not fatal — the list is still usable without the "Audited" marker, so
 * it degrades to unannotated rather than to an error.
 */
async function listAuditedAnalysisIds(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('ats_audits')
      .select('analysis_id');

    if (error) {
      console.error('Failed to read audited analysis ids:', error);
      return new Set();
    }

    return new Set((data ?? []).map((row) => row.analysis_id as string));
  } catch {
    return new Set();
  }
}
