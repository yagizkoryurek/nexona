import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Guards the invariants every `/api/mobile/*` route must hold.
 *
 * These routes are the mobile counterpart of the dashboard Server Actions, and
 * CLAUDE.md is explicit that the relationship is function-level reuse with
 * sequence-level duplication: each route repeats its action's *order of
 * operations* while calling the same `lib/ai` functions. That duplication is
 * accepted, but it means a security or quota property can now drift on one
 * side without the other noticing. Six action/route pairs is where that stops
 * being tractable by review alone.
 *
 * Like `delete-account-action.test.ts`, these assertions read source files as
 * *text*. No route is executed, no request is made, no Supabase or Gemini call
 * happens. That is a weaker guarantee than running them and is deliberately
 * not presented as more: what these catch is a future edit that drops a
 * `resolveAiUsage`, swaps the bearer client for the cookie client, reserves a
 * usage slot before the cache check, or widens Interview Prep's select. Proving
 * the routes actually work still needs an authenticated end-to-end run, which
 * no harness in this repository performs.
 *
 * Runs on Node's built-in runner — this repository has no test framework and
 * adding one remains its own decision.
 */

/** Every mobile route that calls Gemini behind an analysis id. */
const ANALYSIS_ROUTES = [
  "ats-checker",
  "resume-optimizer",
  "cover-letter",
  "career-insights",
  "interview-prep",
] as const;

/** Those, plus the one route whose input is an uploaded file rather than an id. */
const ALL_ROUTES = ["resume-analyzer", ...ANALYSIS_ROUTES] as const;

/** The routes that serve a stored result before spending a model call. */
const CACHED_ROUTES = [
  "ats-checker",
  "career-insights",
  "interview-prep",
] as const;

/**
 * Comments in these files describe the very properties being asserted — the
 * Interview Prep route's own comment names `overall_score` and `ats_score` as
 * things it must not fetch. Asserting against raw text would let that comment
 * fail the test that protects it. Strip comments so every assertion below is
 * about executable code only.
 *
 * Block comments go first, then whole-line `//` comments. Trailing comments
 * after code are left alone, which is safe here because this codebase puts
 * every explanatory comment on its own line — and stripping `//` mid-line
 * would corrupt any string literal containing one.
 */
function codeWithoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

function routeSource(route: string): string {
  return codeWithoutComments(
    readFileSync(join(import.meta.dirname, route, "route.ts"), "utf8"),
  );
}

// Widened to `string` on purpose: the assertions below iterate over several
// different route subsets, and narrowing the key to the literal union would
// make every one of those loops need its own cast.
const sources = new Map<string, string>(
  ALL_ROUTES.map((route) => [route, routeSource(route)]),
);

function source(route: string): string {
  const found = sources.get(route);
  assert.ok(found, `no source loaded for route ${route}`);
  return found;
}

// --- Authentication -------------------------------------------------------

test("every mobile route authenticates by bearer token, not cookies", () => {
  for (const route of ALL_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /bearerToken\(request\)/,
      `${route}: must read the token via bearerToken()`,
    );
    assert.match(
      code,
      /createBearerClient\(token\)/,
      `${route}: must build its Supabase client from that token`,
    );
    assert.doesNotMatch(
      code,
      /@\/lib\/supabase\/server/,
      `${route}: must not use the cookie client — a mobile caller has no cookie jar`,
    );
  }
});

test("every mobile route verifies the session with getUser, never getSession", () => {
  for (const route of ALL_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /supabase\.auth\.getUser\(\)/,
      `${route}: must verify the token against the Auth server`,
    );
    assert.doesNotMatch(
      code,
      /getSession\(/,
      `${route}: getSession trusts the token unverified`,
    );
  }
});

// --- Authorization / RLS --------------------------------------------------

test("analysis lookups rely on RLS rather than a client-supplied user id", () => {
  for (const route of ANALYSIS_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /\.from\("resume_analyses"\)[\s\S]*?\.eq\("id", analysisId\)/,
      `${route}: must fetch the analysis by id`,
    );
    // A `user_id` filter read off the request body would be the classic way to
    // turn an RLS-scoped read into an IDOR. Ownership comes from the token.
    assert.doesNotMatch(
      code,
      /\.eq\("user_id"/,
      `${route}: ownership is enforced by RLS, not by a filter`,
    );
  }
});

test("rows are written with the verified user id, never one from the body", () => {
  for (const route of ["cover-letter", "career-insights", "interview-prep"]) {
    const code = source(route);

    assert.match(
      code,
      /user_id: user\.id/,
      `${route}: inserts must carry the id from getUser()`,
    );
  }
});

test("every analysis route validates its id as a UUID before querying", () => {
  for (const route of ANALYSIS_ROUTES) {
    assert.match(
      source(route),
      /analysisId: z\.string\(\)\.uuid\(\)/,
      `${route}: must re-validate the id server-side`,
    );
  }
});

// --- AI usage quota -------------------------------------------------------

test("every route reserves a usage slot and resolves both outcomes", () => {
  for (const route of ALL_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /reserveAiUsage\(supabase, "[a-z-]+"\)/,
      `${route}: must reserve before calling Gemini`,
    );
    assert.match(
      code,
      /resolveAiUsage\(supabase, reservation\.reservationId, "succeeded"\)/,
      `${route}: must resolve a successful call`,
    );
    assert.match(
      code,
      /resolveAiUsage\(supabase, reservation\.reservationId, "failed"\)/,
      `${route}: must release the slot when the call fails`,
    );
  }
});

test("each route reserves against its own tool name", () => {
  // The AiTool union matches the dashboard route segment exactly, so a
  // copy-paste that leaves the source route's name would bill the wrong tool
  // and silently share its quota.
  for (const route of ALL_ROUTES) {
    assert.match(
      source(route),
      new RegExp(`reserveAiUsage\\(supabase, "${route}"\\)`),
      `${route}: must reserve under its own tool name`,
    );
  }
});

test("a rate-limited request answers with its mapped status and retry hint", () => {
  for (const route of ALL_ROUTES) {
    assert.match(
      source(route),
      /formatRateLimitError\(reservation\),\s*rateLimitStatus\(reservation\.reason\),\s*reservation\.retryAfterSeconds/,
      `${route}: must map the reason to a status and pass the retry hint`,
    );
  }
});

test("cached routes reserve only after the stored-result branch can return", () => {
  // Reserving first would charge a usage slot for a cache hit — the one
  // ordering mistake that is invisible in review and costs users their quota.
  for (const route of CACHED_ROUTES) {
    const code = source(route);

    const storedRead = code.indexOf("storedRows");
    // The call site, not the identifier — every one of these files imports
    // `reserveAiUsage` at the top, so a bare search would always "find" it
    // first and the ordering assertion would be vacuous.
    const reserve = code.indexOf("reserveAiUsage(supabase");

    assert.ok(storedRead !== -1, `${route}: expected a stored-result read`);
    assert.ok(reserve !== -1, `${route}: expected a usage reservation`);
    assert.ok(
      storedRead < reserve,
      `${route}: the cache check must come before reserveAiUsage`,
    );
  }
});

test("stored jsonb is re-validated on read rather than trusted", () => {
  const schemas: Record<string, string> = {
    "ats-checker": "atsAuditSchema",
    "career-insights": "careerInsightsSchema",
    "interview-prep": "interviewPrepSchema",
  };

  for (const route of CACHED_ROUTES) {
    assert.match(
      source(route),
      new RegExp(`${schemas[route]}\\.safeParse\\(stored\\.`),
      `${route}: a stored row may predate the current schema`,
    );
  }
});

// --- Score containment ----------------------------------------------------

test("interview prep is never fetched the scores or the suggestions", () => {
  // Structural containment, not a prompt instruction: the model cannot be
  // shown what the query never retrieves. Widening this select to match the
  // sibling routes would silently undo it.
  const select = source("interview-prep").match(
    /\.select\(([\s\S]*?)\)\s*\.eq\("id", analysisId\)/,
  );
  assert.ok(select, "interview-prep: could not locate its analysis select");

  for (const column of ["overall_score", "ats_score", "suggestions"]) {
    assert.doesNotMatch(
      select[1],
      new RegExp(column),
      `interview-prep must not fetch ${column}`,
    );
  }
});

test("career insights does receive both scores as fenced context", () => {
  // The deliberate counterpart to the test above — asserted so that a future
  // reader "harmonising" the two routes has to break a named expectation
  // rather than quietly converge them.
  const code = source("career-insights");

  assert.match(code, /overallScore: row\.overall_score/);
  assert.match(code, /atsScore: row\.ats_score/);
});

test("no route echoes a score for a tool that has none", () => {
  // Scoped to what actually leaves the handler, not the whole file. Career
  // Insights legitimately passes `atsScore: row.ats_score` *into* the model
  // call as fenced context, so a whole-file search has to either tolerate that
  // string anywhere — which makes the assertion vacuous — or ban it outright,
  // which would fail a correct route. Only the response payload is in question.
  for (const route of ["career-insights", "interview-prep"]) {
    const payloads = source(route).match(
      /Response\.json\(\{[\s\S]*?\n\s*\}\);/g,
    );

    // Exactly two: the stored-result branch and the fresh-generation branch.
    // Asserted rather than assumed so that a payload the regex fails to reach
    // is a failure, not a silently vacuous pass — the trap this test is
    // replacing.
    assert.equal(
      payloads?.length,
      2,
      `${route}: expected a stored and a fresh response payload`,
    );

    for (const payload of payloads ?? []) {
      for (const field of [
        "ats_score",
        "overall_score",
        "atsScore",
        "overallScore",
      ]) {
        assert.doesNotMatch(
          payload,
          new RegExp(field),
          `${route}: must not return ${field} in its response payload`,
        );
      }
    }
  }
});

// --- Request validation and error handling --------------------------------

test("JSON routes reject an unparseable body before doing any work", () => {
  for (const route of ANALYSIS_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /await request\.json\(\)/,
      `${route}: expected a JSON body`,
    );
    assert.match(
      code,
      /jsonError\("Expected a JSON request body\.", 400\)/,
      `${route}: a malformed body is a 400, not a crash`,
    );
  }
});

test("cover letter validates its job details with the shared schema", () => {
  const code = source("cover-letter");

  assert.match(
    code,
    /job: coverLetterInputSchema/,
    "cover-letter: must compose the shared input schema, not restate its fields",
  );
  assert.match(
    code,
    /from "@\/lib\/ai\/cover-letter-schema"/,
    "cover-letter: the schema comes from the client-safe module",
  );
});

test("cover letter persists the job description it was given", () => {
  // Migration 0004 stores the description permanently so a letter has a
  // reconstructable record of the job it was written for.
  const code = source("cover-letter");

  assert.match(code, /job_title: job\.jobTitle/);
  assert.match(code, /company_name: job\.companyName \?\? null/);
  assert.match(code, /job_description: job\.jobDescription/);
});

test("a failed model call is a 502 and never leaks the provider's error", () => {
  for (const route of ALL_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /error instanceof z\.ZodError/,
      `${route}: a malformed response is distinguished from an outage`,
    );
    assert.doesNotMatch(
      code,
      /jsonError\(\s*(?:String\()?error/,
      `${route}: a raw error must never reach the client`,
    );
    assert.doesNotMatch(
      code,
      /Gemini|GoogleGenAI/,
      `${route}: no provider name in a user-facing route`,
    );
  }
});

test("every route has an outer catch that answers 500", () => {
  for (const route of ALL_ROUTES) {
    const code = source(route);

    assert.match(
      code,
      /export async function POST\(request: Request\) \{\s*try \{/,
      `${route}: the handler body must be wrapped`,
    );
    assert.match(
      code,
      /jsonError\("Something went wrong\. Please try again\.", 500\)/,
      `${route}: an unexpected throw is a 500 with generic copy`,
    );
    assert.match(
      code,
      new RegExp(`Unexpected error in POST /api/mobile/${route}`),
      `${route}: the outer catch must log which route threw`,
    );
  }
});

test("routes that persist a derived document still return it on insert failure", () => {
  // The model call is already paid for, so a failed insert costs the user
  // their history, not their result.
  for (const route of ["cover-letter", "career-insights", "interview-prep"]) {
    assert.match(
      source(route),
      /persisted: !insertError/,
      `${route}: must report persistence rather than fail the request`,
    );
  }
});

test("the optimizer persists nothing, by design", () => {
  const code = source("resume-optimizer");

  assert.doesNotMatch(
    code,
    /\.insert\(/,
    "resume-optimizer: there is no table for optimizations",
  );
  assert.doesNotMatch(
    code,
    /persisted/,
    "resume-optimizer: nothing was meant to be saved, so nothing is reported",
  );
});

test("every route declares the Gemini-call duration cap", () => {
  for (const route of ALL_ROUTES) {
    assert.match(
      source(route),
      /export const maxDuration = 60;/,
      `${route}: must declare maxDuration like its dashboard page`,
    );
  }
});
