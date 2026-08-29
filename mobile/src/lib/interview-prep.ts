import { postJsonToApi, type ApiResult } from '@/lib/api';

/**
 * Mirrors `InterviewPrep` / the `generateInterviewPrep` payload in the web
 * app's `src/lib/ai/interview-prep.ts` and
 * `src/components/dashboard/interview-prep-action.ts`.
 *
 * Declared by hand rather than imported for the same reason as
 * `lib/career-insights.ts` and `lib/ats-audit.ts`: the root tsconfig excludes
 * `mobile/`, so there is no shared module graph. This is the response contract
 * of one HTTP endpoint, and the endpoint validates against its own Zod schema
 * before replying — so a mismatch here surfaces as a type error on this side,
 * never as bad data reaching the server.
 *
 * Two properties of that schema matter to anything rendering this, and both
 * differ from the siblings:
 *
 * 1. **Every array carries at least one entry.** Unlike the ATS audit (where
 *    empty findings are the good outcome) and Career Insights (where an empty
 *    `skillGaps` is), nothing here has an emptiness that would be good news —
 *    the uncomfortable material lives inside `questions` as a `resumeProbe`
 *    category rather than as its own list. So a renderer needs no "nothing
 *    found" copy: an empty array means the call failed validation upstream and
 *    never reached this client.
 * 2. **Every value worth branching on is a closed enum** (`category`,
 *    `priority`), so nothing has to parse English to pick an ordering.
 *
 * Notably absent: any number at all, and this goes further than Career
 * Insights. That tool is at least shown the stored scores as fenced context;
 * this one is never shown them — the route's `select` fetches neither, so the
 * containment is structural rather than prompt-level. Nothing scorelike can
 * reach this screen, and nothing here should render one.
 */

export type InterviewQuestionCategory =
  | 'behavioral'
  | 'technical'
  | 'experience'
  | 'resumeProbe';

export type InterviewQuestion = {
  question: string;
  category: InterviewQuestionCategory;
  /** What in *this* resume prompts the question. Keeps it from being generic. */
  whyAsked: string;
  /** How to approach it using the candidate's own material. */
  answerGuidance: string;
};

export type InterviewTalkingPoint = {
  point: string;
  /** The resume content behind it, so the point is never a bare assertion. */
  evidence: string;
};

export type InterviewPreparationFocus = {
  priority: 'high' | 'medium' | 'low';
  area: string;
  rationale: string;
};

export type InterviewPrep = {
  overview: string;
  /** Six to twelve, shaped by the Gemini response schema rather than by Zod. */
  questions: InterviewQuestion[];
  talkingPoints: InterviewTalkingPoint[];
  preparationFocus: InterviewPreparationFocus[];
};

export type InterviewPrepResult = {
  prep: InterviewPrep;
  fileName: string;
  /** Whether this came from the database or from a fresh model call. */
  source: 'stored' | 'fresh';
  /** False when a fresh preparation was generated but could not be saved. */
  persisted: boolean;
};

/**
 * Requests interview preparation for one of the caller's own analyses.
 *
 * The route serves a stored preparation when one exists, so re-opening a resume
 * is free and does not consume a usage slot. Pass `refresh` to force a new one;
 * each appends a row rather than replacing the last, and readers take the
 * newest.
 */
export async function generateInterviewPrep(
  analysisId: string,
  refresh = false
): Promise<ApiResult<InterviewPrepResult>> {
  return postJsonToApi<InterviewPrepResult>('/api/mobile/interview-prep', {
    analysisId,
    refresh,
  });
}
