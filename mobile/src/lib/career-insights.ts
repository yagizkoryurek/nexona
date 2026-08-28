import { postJsonToApi, type ApiResult } from '@/lib/api';

/**
 * Mirrors `CareerInsights` / the `generateCareerInsights` payload in the web
 * app's `src/lib/ai/career-insights.ts` and
 * `src/components/dashboard/career-insights-action.ts`.
 *
 * Declared by hand rather than imported for the same reason as
 * `lib/ats-audit.ts` and `lib/resume-analysis.ts`: the root tsconfig excludes
 * `mobile/`, so there is no shared module graph. This is the response contract
 * of one HTTP endpoint, and the endpoint validates against its own Zod schema
 * before replying — so a mismatch here surfaces as a type error on this side,
 * never as bad data reaching the server.
 *
 * Two properties of that schema matter to anything rendering this:
 *
 * 1. **`skillGaps` is the one array with no minimum, and empty is the *good*
 *    outcome** — a well-rounded profile may genuinely have no gap worth naming,
 *    and the web schema omits the minimum precisely so the model is not
 *    pressured into inventing a weakness. A renderer must say so rather than
 *    showing a blank panel. `strengthThemes`, `suitableRoles`, and `nextSteps`
 *    are the deliverable and each carries at least one entry.
 * 2. **Every value worth branching on is a closed enum** (`fit`, `impact`,
 *    `priority`), so nothing has to parse English to pick an ordering.
 *
 * Notably absent: any number at all. `careerInsightsSchema` has no numeric
 * field, so unlike the ATS audit there is no score arriving alongside the
 * document. The stored `overall_score` and `ats_score` are read-only context
 * the model reasons from and are deliberately not echoed back — re-displaying
 * them here would invite exactly the "explain the number" reading the prompt
 * forbids. Nothing in this screen should render one.
 */

export type CareerRoleFit = 'strong' | 'possible' | 'stretch';

export type CareerStrengthTheme = {
  theme: string;
  /** The resume content the theme is drawn from. */
  evidence: string;
};

export type CareerSuitableRole = {
  title: string;
  fit: CareerRoleFit;
  rationale: string;
};

export type CareerSkillGap = {
  skill: string;
  impact: 'high' | 'medium' | 'low';
  why: string;
};

export type CareerNextStep = {
  priority: 'high' | 'medium' | 'low';
  action: string;
  rationale: string;
};

export type CareerInsights = {
  positioning: string;
  strengthThemes: CareerStrengthTheme[];
  suitableRoles: CareerSuitableRole[];
  /** Empty means no gap was worth naming, not that data is missing. */
  skillGaps: CareerSkillGap[];
  nextSteps: CareerNextStep[];
};

export type CareerInsightsResult = {
  insights: CareerInsights;
  fileName: string;
  /** Whether this came from the database or from a fresh model call. */
  source: 'stored' | 'fresh';
  /** False when fresh insights were generated but could not be saved. */
  persisted: boolean;
};

/**
 * Requests career insights for one of the caller's own analyses.
 *
 * The route serves stored insights when they exist, so re-opening a resume is
 * free and does not consume a usage slot. Pass `refresh` to force a new set;
 * each appends a row rather than replacing the last, and readers take the
 * newest.
 */
export async function generateCareerInsights(
  analysisId: string,
  refresh = false
): Promise<ApiResult<CareerInsightsResult>> {
  return postJsonToApi<CareerInsightsResult>('/api/mobile/career-insights', {
    analysisId,
    refresh,
  });
}
