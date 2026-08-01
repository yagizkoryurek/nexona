# Nexona — Project Instructions

The single source of truth for this codebase: what it is, what currently
works, and the rules for working on it. Keep this file accurate — if a change
makes a statement here false, update it in the same pass.

## Project Overview

Nexona is an AI-powered résumé analysis SaaS. A user uploads a résumé and gets
back a structured, specific read of it — how it lands with a recruiter and how
it survives automated applicant tracking screening — instead of generic career
advice.

**Product vision.** Start with analysis (shipped), then grow into a toolkit
that acts on the findings: optimizing the résumé, checking ATS compatibility
in depth, generating a matching cover letter, and surfacing career insights.

**Target users.** Students, recent graduates, working professionals, and
career changers — anyone who is applying and not hearing back.

## Tech Stack

| Area            | Choice                                                             |
| --------------- | ------------------------------------------------------------------ |
| Framework       | Next.js 15.5.21 (App Router), React 19.1.0                         |
| Language        | TypeScript 5 (strict), `@/*` → `src/*`                             |
| Styling         | Tailwind CSS v4                                                    |
| Components      | shadcn/ui on **Radix UI** (`radix-ui` barrel), preset Nova         |
| Icons / Font    | Lucide, Geist                                                      |
| Auth + DB       | Supabase — `@supabase/ssr` 0.12.3, `@supabase/supabase-js` 2.110.8 |
| AI              | Google Gemini — `@google/genai` 2.13.0, model `gemini-3.6-flash`   |
| PDF extraction  | `unpdf` 1.8.0                                                      |
| DOCX extraction | `mammoth` 1.12.0                                                   |
| Forms           | react-hook-form 7 + Zod 4 (`@hookform/resolvers`)                  |
| Animation       | `tw-animate-css` (no animation library)                            |
| Tooling         | ESLint 9 flat config, Prettier 3 + `prettier-plugin-tailwindcss`   |
| Package manager | pnpm 11.17.0                                                       |
| Deploy target   | Vercel (not yet deployed — no `vercel.json`/`.vercel` in repo)     |

Why some of these: `unpdf` over `pdf-parse`/raw pdfjs because it inlines the
PDF.js worker — a separate `pdf.worker.mjs` cannot resolve inside a Vercel
serverless bundle. Gemini over Anthropic to avoid API cost during development;
the integration is isolated so the provider can be swapped again cheaply.

## Current Features

Everything below is implemented and verified working end to end.

**Landing page** — Navbar (responsive, mobile menu), Hero with static product
preview, Features, How It Works, Pricing (billing toggle), FAQ, Footer.

**Authentication** (Supabase, cookie sessions) — sign up with required email
confirmation, sign in, sign out, forgot password, reset password, auth
callback for emailed links, route protection, session refresh.

**Dashboard shell** — a guarded sidebar layout at `/dashboard` with persistent
navigation, collapse state that survives reload, and a mobile drawer. Overview
lives at `/dashboard`; each tool gets its own route beneath it.

**Resume Analyzer** — drag-and-drop or click-to-browse upload, client and
server validation, text extraction, Gemini analysis, persistence, results UI.
Supported formats: **PDF** and **DOCX** (`.doc` is not — see Known
Limitations). Max upload 10 MB (`MAX_RESUME_SIZE_BYTES`).

**Analysis output** — Overall Score (0–100), ATS Score (0–100), a one-sentence
summary, and lists of Strengths, Weaknesses, and Suggestions.

**Resume Optimizer** — pick a previously analyzed resume, Gemini rewrites it
using the stored analysis (scores, summary, strengths, weaknesses,
suggestions) alongside the resume's own stored text, preserving every factual
detail (employers, titles, dates, degrees) while improving wording and
structure. Result is displayed, not persisted. Deliberately minimal by design —
**no** export, download, version history, side-by-side comparison, editing,
chat, or multiple optimization modes. Only analyses that have a stored
`resume_text` are selectable — see Persistence.

**ATS Compatibility Check** — pick a previously analyzed resume and Gemini
produces a detailed, **qualitative** ATS audit of it: an executive summary,
four status-graded sections (formatting, section structure, keywords,
readability), present/missing keywords, missing sections, ATS blockers ranked
by severity, and priority-ranked recommendations. Persisted to `ats_audits`.

**It deliberately does not produce a score.** The ATS Score already stored on
the analysis is the single source of truth and is displayed here labelled with
its provenance ("from your resume analysis"); Gemini is never shown that number
and never asked for one. Two independent scores for the same resume would
legitimately disagree between calls, so the audit explains the existing score
rather than competing with it. Re-opening an audited resume serves the stored
audit with no model call; "Run a fresh audit" appends a new one.

**Cover Letter Generator** — pick a previously analyzed resume, enter a job
title, optional company name, and job description, and Gemini writes a cover
letter grounded in that resume's stored text and its analysis (scores,
summary, strengths, weaknesses, suggestions). Every letter is a new row in
`cover_letters` — there is no single "the" letter for an analysis to
overwrite, since one resume can legitimately be applied to many jobs.
"Generate another" returns to the job form with the same resume and the same
job details prefilled; "Choose a different resume" resets fully. No history
view of past letters yet (see Known Limitations), though the query to list
them already exists (`listCoverLetters` in `cover-letter-action.ts`).

**The model is instructed never to invent a professional fact.** Every
employer, title, date, credential, skill, project, or achievement referenced
must already appear in the resume text; where the job description asks for
something the resume doesn't show, the prompt instructs generalizing rather
than fabricating a specific instance. This is a prompt-level mitigation, not a
guarantee — see Known Limitations.

**Career Insights** — pick a previously analyzed resume and Gemini assesses
the candidate's professional position: how the profile reads, recurring
strength themes with the resume evidence behind each, roles it already
supports (graded `strong` / `possible` / `stretch`), skill gaps holding it
back, and prioritized next steps. Resume-only by design — there is no
target-role or career-goal input; a future sprint may add one, but this tool
does not attempt to guess intent beyond what the resume itself shows.
Persisted to `career_insights`. Re-opening an already-generated resume serves
the stored insights with no model call; "Generate again" appends a new one —
the same stored-result caching and append-only shape as the ATS Check, not the
Cover Letter Generator's always-a-new-row model, because insights for a resume
converge on one answer rather than varying per job.

**The stored `overall_score` and `ats_score` are passed to the model as
read-only context, never as this tool's subject.** They inform the model's
reasoning about the resume's history, but the prompt explicitly forbids
reinterpreting them, explaining them, deriving a new score from them, or
letting them dominate its conclusions — conclusions must come primarily from
the resume text itself. This is a prompt-level mitigation, not a guarantee;
`careerInsightsSchema` has no numeric field at all, which is the structural
half of the same containment. The UI never renders either score — no
`ScoreRing`, no number anywhere in this tool's results — since re-displaying
them here would invite exactly the "explain the number" reading the prompt
forbids. Career Insights is also instructed never to invent a professional
fact absent from the resume, same mitigation as the Optimizer and Cover Letter
Generator.

**Persistence** — every completed analysis is written to `resume_analyses`,
scoped to its owner by Row Level Security. The uploaded file itself is never
stored. Its extracted text **is** now retained (`resume_text`, added for the
Resume Optimizer) — a deliberate reversal of this table's original design,
which discarded it after analysis. The column is nullable and forward-only:
analyses created before this shipped have no `resume_text` and are simply
absent from the Optimizer's, ATS Check's, Cover Letter Generator's, and Career
Insights' pickers, not treated as broken.

ATS audits, cover letters, and career insights are each written to their own
separate table (`ats_audits`, `cover_letters`, `career_insights`) rather than
onto the analysis row. That is a security choice, not a modelling one:
updating the analysis row would require an UPDATE policy on `resume_analyses`,
and RLS policies are per-row, not per-column — granting it would let a client
rewrite scores, summary, and `resume_text` too. All four tables stay
insert-and-read only. None of the three are merged into one table either,
despite `ats_audits` and `career_insights` sharing an identical column shape:
an audit or an insights document is one jsonb document every client reads the
same way, but a cover letter's two real inputs (job title, job description)
and one output (the letter) are naturally their own columns, and a shared
table would leave half its columns null depending on which kind a row was.
`ats_audits` and `career_insights` stay separate from each other too, despite
that identical shape — see Database for why (versioning, not columns).

## Authentication Flow

Exactly as it behaves today.

**Routes.** `/` (public landing) · `/sign-in` · `/get-started` (sign up) ·
`/forgot-password` · `/reset-password` · `/auth/callback` · `/dashboard`.

**Middleware** (`middleware.ts` → `src/lib/supabase/middleware.ts`) is written
to run on every non-static request, but **is not currently registered with
Next.js and therefore never executes** — see Known Limitations. Everything in
this subsection describes intended behaviour that is presently inert; the only
live guard is the `getUser()` check in `dashboard/layout.tsx`. It calls
`supabase.auth.getUser()` — which revalidates the token against the Auth server
and writes rotated cookies onto the response — then applies two rules:

- `PROTECTED_PREFIXES = ["/dashboard"]` — no session → redirect to
  `/sign-in?next=<path>`.
- `AUTH_ONLY_PATHS = ["/sign-in", "/get-started", "/forgot-password"]` —
  has session → redirect to `/dashboard`.

`/` is deliberately **not** in either list: it is always the public landing
page regardless of session state. An authenticated user visiting `/` sees the
landing page, not a redirect. This was tried and explicitly reverted.

`/reset-password` is deliberately **not** in `AUTH_ONLY_PATHS`: a user arriving
from a recovery email _is_ signed in, so listing it would make the reset flow
impossible to complete. That page guards itself instead.

**Flows.**

- _Sign up_ → `signUp` action → Supabase sends confirmation email → form swaps
  to a "check your email" panel (no redirect — the account is unusable until
  confirmed) → user clicks link → `/auth/callback` exchanges the code for a
  session → `/dashboard`.
- _Sign in_ → `signIn` action → `redirect(safeRedirectPath(next))`, which
  defaults to `/dashboard`.
- _Forgot password_ → always shows the same success panel whether or not the
  address exists → emailed link → `/auth/callback` → `/reset-password`.
- _Reset password_ → `updateUser({ password })` → `signOut()` → redirect to
  `/sign-in?notice=reset-success`.
- _Sign out_ → `signOut()` → redirect to `/`.

**Security properties.** `getUser()` is used for every auth decision, never
`getSession()` (which trusts the cookie unverified). Sign-in errors are
deliberately identical for unknown-email and wrong-password to prevent user
enumeration. `safeRedirectPath` (`src/lib/auth-redirect.ts`) rejects
cross-origin and protocol-relative `next` values. Server Actions carry Next's
built-in Origin-header CSRF check. `/dashboard` was designed to be guarded
twice — middleware plus a `getUser()` check in `dashboard/layout.tsx` — but
with the middleware inert, **the layout check is the only thing protecting it**.
It does hold: every `/dashboard/*` route renders through that layout, and
signed-out requests redirect. The redundancy, not the protection, is what is
currently missing.

## Project Structure

```
middleware.ts                  Thin call site → lib/supabase/middleware.
                               NOT currently registered — see Known Limitations
supabase/migrations/           SQL, applied manually via Supabase SQL Editor

src/app/
  page.tsx                     Public landing page
  (auth)/                      sign-in, get-started, forgot-password,
                               reset-password + shared auth layout
  auth/callback/route.ts       Code exchange for emailed links
  dashboard/                   Protected app shell
    layout.tsx                 getUser() guard + sidebar shell
    page.tsx                   Overview (greeting + entry point)
    resume-analyzer/page.tsx   Resume Analyzer (maxDuration lives here)
    resume-optimizer/page.tsx  Resume Optimizer (maxDuration lives here)
    ats-checker/page.tsx       ATS Compatibility Check (maxDuration lives here)
    cover-letter/page.tsx      Cover Letter Generator (maxDuration lives here)
    career-insights/page.tsx   Career Insights (maxDuration lives here)

src/components/
  ui/                          shadcn-generated primitives — DO NOT EDIT
                               (present: accordion, button, checkbox, input,
                               label, separator, sheet, sidebar, skeleton,
                               textarea, tooltip)
  auth/                        Forms, shared auth UI, auth-actions.ts
  dashboard/                   dashboard-sidebar, dashboard-nav-items, overview,
                               resume-analyzer, resume-dropzone,
                               analysis-results, resume-analyze-action.ts,
                               resume-optimizer, resume-picker,
                               resume-optimization-results,
                               resume-optimize-action.ts,
                               ats-checker, ats-audit-results,
                               ats-audit-action.ts,
                               cover-letter-generator, cover-letter-job-form,
                               cover-letter-results, cover-letter-action.ts,
                               career-insights-generator,
                               career-insights-results,
                               career-insights-action.ts,
                               dashboard-panel, list-panel
  hero/ features/ pricing/     Landing page sections
  faq/ footer/ navbar/ how-it-works/
  score-ring.tsx               Shared 0–100 ring (landing + analyzer + ATS)
  decorative-backdrop.tsx      Shared backdrop (landing + auth + dashboard)

src/hooks/use-mobile.ts        Generated with the sidebar block — DO NOT EDIT

src/lib/
  supabase/                    client.ts (browser), server.ts (RSC/actions),
                               middleware.ts (session refresh + guards)
  ai/gemini.ts                 Shared Gemini client, MODEL, requestStructuredJson
  ai/resume-analysis.ts        Prompt + schemas, requestResumeAnalysis
  ai/resume-optimization.ts    Prompt + schemas, requestResumeOptimization
  ai/ats-audit.ts              Prompt + schemas, requestAtsAudit
  ai/cover-letter.ts           Prompt + Gemini call, requestCoverLetter
  ai/cover-letter-schema.ts    Client-safe Zod schema — imports neither
                               ./gemini nor ./cover-letter (see AI Architecture)
  ai/career-insights.ts        Prompt + schemas, requestCareerInsights
  ai/interview-prep.ts         Prompt + schemas, requestInterviewPrep.
                               Mid-sprint — no caller wired up yet
  resume-file.ts               Extension + size validation (shared client/server)
  resume-text-extraction.ts    PDF (unpdf) + DOCX (mammoth) → text
  auth-redirect.ts             safeRedirectPath, DEFAULT_AUTHENTICATED_PATH
  utils.ts                     cn()

src/types/mammoth.d.ts         Local ambient types (mammoth ships none)
```

**The dashboard shell.** `dashboard/layout.tsx` is the guarded app shell: it
runs `getUser()`, then renders `SidebarProvider` → `DashboardSidebar` →
`SidebarInset`. Each tool is its own route underneath, so adding one means
adding a route plus an entry in `dashboard-nav-items.ts`.

`DashboardSidebar` is a client component because the active item is derived from
`usePathname()`. Overview matches its href exactly; tool routes match by prefix,
so nested pages still mark their parent active.

`DashboardNavItem` (`dashboard-nav-items.ts`) is a discriminated union on
`status`. `available` items are real routes — an entry with that status is a
promise the route works, rendered as a `Link`. `comingSoon` items have no
`href`/`match` field at all, so a dead link is a compile error rather than a
convention to remember; they render as non-navigable, `aria-disabled` buttons
in their own "Coming Soon" `SidebarGroup` below the shipped tools. Shipping a
planned tool means flipping its `status` to `"available"` and adding
`href`/`match` — no component code changes.

Collapse behaviour is the block's `offcanvas` default, not `icon`. Icon mode
requires a `tooltip` on every menu button, and the generated `ui/tooltip.tsx`
exports `TooltipProvider` separately rather than wrapping itself — using a
tooltip without a provider ancestor throws at runtime. `SidebarProvider` writes
a `sidebar_state` cookie, which the layout reads server-side so the sidebar does
not render open and then snap shut.

## AI Architecture

```
Upload → Validate → Extract → Analyze → Validate → Persist → Render
```

1. **Upload** — `ResumeDropzone` (client) holds the `File` in local state.
   `validateResumeFile` checks extension and size immediately.
2. **Submit** — `ResumeAnalyzer` owns the phase machine
   (`select → analyzing → results`) and posts a `FormData` to the
   `analyzeResume` Server Action.
3. **Server guard** — the action re-runs `getUser()` and re-runs
   `validateResumeFile`. Client validation is a convenience, not a trust
   boundary; the action is directly callable.
4. **Extract** — `extractResumeText` branches on extension: `unpdf` for PDF,
   `mammoth` for DOCX, explicit error for `.doc`. Output under 100 characters
   is treated as a failure (likely a scan with no text layer).
5. **Analyze** — `requestResumeAnalysis` calls Gemini with
   `responseMimeType: "application/json"` and a typed `responseSchema`, so the
   model is constrained to the six-field shape rather than prompted for JSON.
6. **Validate** — the response is parsed and checked against
   `resumeAnalysisSchema` (Zod) before being trusted. A malformed response
   surfaces as a user-facing error, never a stored row.
7. **Persist** — one insert into `resume_analyses`, including the extracted
   `resume_text` (added for the Optimizer below). RLS enforces ownership.
8. **Render** — `AnalysisResults` displays two `ScoreRing`s plus the three
   lists, with "Analyze another resume" to reset.

**Resume Optimizer pipeline:**

```
Select → Fetch → Optimize → Render
```

1. **Select** — `ResumePicker` lists the caller's own analyses that have a
   stored `resume_text` (fetched server-side in
   `dashboard/resume-optimizer/page.tsx`); analyses from before that column
   existed are absent, with an empty-state pointing at Resume Analyzer if none
   qualify.
2. **Submit** — `ResumeOptimizer` owns the phase machine
   (`select → optimizing → results`) and calls the `optimizeResume` Server
   Action with the chosen analysis's id.
3. **Server guard** — the action re-runs `getUser()`, validates the id is a
   UUID, and re-fetches the full row itself rather than trusting anything the
   client sent — RLS scopes the fetch to the caller's own rows, so a foreign
   or nonexistent id resolves to the same generic "not found" error either way.
4. **Optimize** — `requestResumeOptimization` sends Gemini both the stored
   `resume_text` and the stored analysis (scores, summary, strengths,
   weaknesses, suggestions), instructed to preserve every factual detail
   exactly and improve only wording, structure, and framing — a prompt-level
   mitigation, not a guarantee, against the model altering facts it was given.
5. **Validate** — the response is parsed and checked against
   `resumeOptimizationSchema` (Zod) before being trusted.
6. **Render** — `ResumeOptimizationResults` displays the rewritten resume as
   preformatted text, with "Try another resume" to reset. Nothing is written
   back to the database — the result is not persisted.

**ATS Compatibility Check pipeline:**

```
Select → Fetch → (stored audit? serve it) → Audit → Validate → Persist → Render
```

1. **Select** — the same `ResumePicker` under the same eligibility rule as the
   Optimizer. `dashboard/ats-checker/page.tsx` additionally queries
   `ats_audits` for the caller's `analysis_id`s and marks already-audited rows
   with an "Audited" annotation.
2. **Submit** — `AtsChecker` owns the phase machine
   (`select → auditing → results`) and calls the `auditResume` Server Action
   with the chosen id and a `refresh` flag.
3. **Server guard** — identical to the Optimizer's: re-runs `getUser()`,
   validates the id is a UUID, re-fetches the row itself under RLS.
4. **Serve stored** — unless `refresh`, the newest `ats_audits` row for that
   analysis is read and re-validated with `atsAuditSchema`. A valid one is
   returned with no model call. **Stored jsonb is re-validated on read, not
   trusted because it was valid on write** — the audit shape will evolve, so a
   row that no longer parses falls through to a fresh audit rather than
   erroring.
5. **Audit** — `requestAtsAudit` sends Gemini only the stored `resume_text`.
   The stored `ats_score` is deliberately withheld: showing the model a number
   to explain would anchor its narrative to that number, which is re-deriving
   the score by another route. The prompt explicitly forbids emitting any
   score, percentage, grade, or rating.
6. **Validate** — checked against `atsAuditSchema` (Zod) before being trusted.
   Note that `findings`, `blockers`, `missingSections`, and the keyword arrays
   have **no minimum length** — unlike the analysis schema. An empty array is
   the good outcome here, and requiring one entry would pressure the model into
   inventing problems.
7. **Persist** — one insert into `ats_audits` with `schema_version`. A failed
   insert is logged and the audit is still returned with `persisted: false`,
   which the UI surfaces quietly. This diverges from `analyzeResume`, which
   errors outright on a failed insert — there the stored row _is_ the product.
8. **Render** — `AtsAuditResults` shows the **stored** `ats_score` in a
   `ScoreRing` captioned "from your resume analysis", the executive summary,
   four status-badged section panels, keyword chips, severity-sorted blockers,
   missing sections, and priority-sorted recommendations. Severity and priority
   ordering is applied in the component; the model returns its own order.

**Cover Letter Generator pipeline:**

```
Select → Enter job details → Generate → Validate → Persist → Render
```

1. **Select** — the same `ResumePicker` under the same eligibility rule as the
   Optimizer and ATS Check, but with no annotation: a letter is keyed to a job,
   not a resume, so "already has a letter" doesn't collapse to one boolean per
   analysis the way "Audited" does.
2. **Enter job details** — `CoverLetterJobForm` (react-hook-form + Zod,
   resolved against `coverLetterInputSchema`) collects `jobTitle` (required),
   `companyName` (optional), and `jobDescription` (required, 50–10,000
   characters). The only form in the dashboard so far; built inline rather
   than as a shared wrapper since there is no second consumer yet.
3. **Submit** — `CoverLetterGenerator` owns the phase machine
   (`select → details → generating → results`) — one phase more than its
   siblings, because a job has to be described, not just selected — and calls
   the `generateCoverLetter` Server Action with the chosen id and the job
   details.
4. **Server guard** — re-runs `getUser()`, validates the id is a UUID and the
   job details against `coverLetterInputSchema` again server-side, re-fetches
   the row itself under RLS — the same shape as the Optimizer's and ATS
   Check's guards, extended to a second input the client can't be trusted on.
5. **Generate** — `requestCoverLetter` sends Gemini the stored `resume_text`,
   the stored analysis (scores, summary, strengths, weaknesses, suggestions —
   reused exactly as the Optimizer already does), and the job details. The
   prompt carries three enforced layers against fabrication: explicit
   source-of-truth framing (every fact must already appear in the resume text),
   a structural instruction to generalize rather than invent when the job asks
   for something the resume doesn't show, and a closing self-check instructing
   the model to verify its own draft against the resume before finalizing. A
   missing company name is handled explicitly in the prompt — address the
   letter generically, never invent a name or emit a placeholder token like
   `[Company Name]`.
6. **Validate** — checked against `coverLetterSchema` (Zod, a single `letter`
   field) before being trusted.
7. **Persist** — one insert into `cover_letters`, **always a new row** — there
   is no "check for an existing letter" branch the way the ATS Check has one,
   because there is no singular "the" letter for an analysis to converge on. A
   failed insert is logged and the letter is still returned with
   `persisted: false`, same divergence-and-reasoning as the ATS Check.
8. **Render** — `CoverLetterResults` displays the letter as preformatted text
   with the job title/company as a caption. "Generate another" returns to the
   job form with the same resume and job details prefilled; "Choose a
   different resume" resets fully.

**Career Insights pipeline:**

```
Select → Fetch → (stored insights? serve them) → Generate → Validate → Persist → Render
```

1. **Select** — the same `ResumePicker` under the same eligibility rule as the
   other three. `dashboard/career-insights/page.tsx` additionally queries
   `career_insights` for the caller's `analysis_id`s and marks already-generated
   rows with an "Insights ready" annotation. Resume-only, by design: unlike the
   Cover Letter Generator there is no second input phase — no target-role or
   career-goal field — so the phase machine has one fewer phase than that tool.
2. **Submit** — `CareerInsightsGenerator` owns the phase machine
   (`select → generating → results`) and calls the `generateCareerInsights`
   Server Action with the chosen id and a `refresh` flag. Structurally this is
   the ATS Check's shape, not the Cover Letter Generator's: an artifact keyed
   to a resume alone, not to a resume-plus-job, converges on one current
   answer rather than many equally valid ones.
3. **Server guard** — identical to the other three: re-runs `getUser()`,
   validates the id is a UUID, re-fetches the row itself under RLS — this time
   selecting `overall_score` and `ats_score` alongside the rest, since this
   pipeline (unlike the ATS Check's) passes both scores through as context.
4. **Serve stored** — unless `refresh`, the newest `career_insights` row for
   that analysis is read and re-validated with `careerInsightsSchema`. A valid
   one is returned with no model call. Stored jsonb is re-validated on read,
   not trusted because it was valid on write, same reasoning as the ATS
   Check's cache: the shape will evolve, so a row that no longer parses falls
   through to fresh generation rather than erroring.
5. **Generate** — `requestCareerInsights` sends Gemini the stored `resume_text`
   plus the full stored analysis, including `overall_score` and `ats_score`.
   This is the one deliberate divergence from the ATS Check's pattern: the ATS
   Check withholds `ats_score` outright so the model cannot anchor to a number
   it was asked to explain; here the scores are relevant context for career
   direction, so they are passed through but explicitly fenced — the prompt
   states they are contextual only and forbids reinterpreting, explaining,
   regenerating, or letting them dominate the reasoning, which must come
   primarily from the resume text. The prompt also forbids any score,
   percentage, grade, salary figure, or market/demand statistic in the output,
   and requires every conclusion to trace to specific resume content.
6. **Validate** — checked against `careerInsightsSchema` (Zod) before being
   trusted. The minimums are split deliberately, not copied from the ATS
   audit's blanket rule: `strengthThemes`, `suitableRoles`, and `nextSteps`
   are the deliverable, so each requires at least one entry, while `skillGaps`
   has no minimum — a genuinely well-rounded profile may have none worth
   naming, and requiring one would pressure the model into inventing a
   weakness, the same reasoning as the audit's `blockers`.
7. **Persist** — one insert into `career_insights` with `schema_version`. A
   failed insert is logged and the insights are still returned with
   `persisted: false`, same divergence-and-reasoning as the ATS Check and
   Cover Letter Generator.
8. **Render** — `CareerInsightsResults` shows the positioning summary,
   strength themes with their resume evidence, suitable roles (fit-sorted,
   `strong` first), skill gaps (impact-sorted, with an explicit "no significant
   gaps" state when the array is empty — that emptiness is the good outcome,
   not a blank panel), and next steps (priority-sorted). Sort ordering is
   applied in the component; the model returns its own order, same convention
   as the ATS Check. Deliberately **no `ScoreRing` and no score anywhere** —
   see Current Features for why re-displaying the stored scores here would
   undercut the containment the prompt enforces.

**Shared AI infrastructure.** `lib/ai/gemini.ts` owns the single `GoogleGenAI`
client, the `MODEL` constant, and `requestStructuredJson` — the call /
empty-text guard / `JSON.parse` / Zod-validate sequence every AI module shares.
Each module keeps its own prompt, Gemini `responseSchema`, and Zod schema.
`JSON.parse` runs before `schema.parse` on purpose: a truncated response must
surface as a `SyntaxError` and a wrong-shaped one as a `ZodError`, because the
Server Actions branch on `error instanceof z.ZodError` to pick their message.
Changing the model is now a one-line edit in one file.

**Client/server import boundary.** `lib/ai/gemini.ts` constructs the
`GoogleGenAI` client at module scope, using `GEMINI_API_KEY` — a server-only
variable. Any client component that imports a _value_ (not just a type) from a
module that itself imports `./gemini`, even transitively, bundles that
construction into the browser and crashes with "API Key must be set when
running in a browser." This bit the Cover Letter Generator once: its job form
needed `coverLetterInputSchema` — a Zod schema, a runtime value, for
`zodResolver` — and that schema originally lived in the same file as
`requestCoverLetter`. The fix is now the standing convention: **any AI
module's input-validation schema that a client component needs as a value
lives in its own dedicated `lib/ai/<tool>-schema.ts` file, importing neither
`./gemini` nor its sibling AI module.** The AI module imports the schema from
there for its own use and must not re-export it as a value — only a
type-only re-export (`export type { ... }`, fully erased at compile time) is
safe to expose from a module that itself imports `./gemini`. `import type` for
a _response_ shape (what the model returns, as opposed to what the client
submits) is always safe regardless of where it's declared, since it carries no
runtime import. See `lib/ai/cover-letter-schema.ts` for the reference shape,
and verify a new one the same way it was verified here: after building,
`grep -rl "GoogleGenAI" .next/static/` must return nothing.

**Database.** Five tables. `public.resume_analyses` — `id`, `user_id` (FK to
`auth.users`, `on delete cascade`), `file_name`, `overall_score`, `ats_score`
(both `check between 0 and 100`), `summary`, `strengths`/`weaknesses`/
`suggestions` (jsonb), `resume_text` (nullable, forward-only — added by
migration `0002`), `created_at`. RLS enabled with INSERT and SELECT policies
scoped to `authenticated`, plus an index on `(user_id, created_at desc)`. No
UPDATE/DELETE policy — with RLS on, the absence of a policy is the denial.

`public.ats_audits` (migration `0003`) — `id`, `analysis_id` (FK to
`resume_analyses`, `on delete cascade`), `user_id` (FK to `auth.users`,
`on delete cascade`), `audit` (jsonb — the whole validated document, so every
client reads one document and validates it with the same schema),
`schema_version` (smallint, default 1), `created_at`. Indexes on
`(analysis_id, created_at desc)` and `(user_id, created_at desc)`. RLS enabled,
INSERT and SELECT policies, no UPDATE/DELETE.

Two things about that table are deliberate and easy to "simplify" wrongly:

- **No `ats_score` column.** The score lives on `resume_analyses` and is the
  single source of truth; duplicating it here would recreate the two-competing-
  scores problem the feature is designed to avoid.
- **The INSERT policy checks parent ownership**, not just `auth.uid() = user_id`.
  The foreign key proves the analysis exists, not that the caller owns it —
  without the `exists (…)` clause a caller could attach rows carrying their own
  `user_id` to someone else's analysis.
- **No unique constraint on `analysis_id`.** Re-auditing appends; readers take
  the newest. Enforcing one audit per analysis would make re-audit an UPDATE,
  reintroducing the policy problem the separate table exists to avoid.

`public.cover_letters` (migration `0004`) — `id`, `analysis_id` (FK to
`resume_analyses`, `on delete cascade`), `user_id` (FK to `auth.users`,
`on delete cascade`), `job_title`, `company_name` (nullable), `job_description`
(**stored permanently, not transient** — see below), `letter`, `schema_version`
(smallint, default 1), `created_at`. Indexes on `(analysis_id, created_at
desc)` and `(user_id, created_at desc)`. RLS enabled, INSERT (with the same
parent-ownership `exists (…)` clause as `ats_audits`) and SELECT policies, no
UPDATE/DELETE.

Two things about that table are deliberate:

- **`job_description` is persisted, not treated as transient input.** Without
  it, a stored letter has no reconstructable record of what job it was written
  for beyond `job_title`/`company_name`, and "Generate another" would have
  nothing to prefill from. Job postings are public listings the user pasted
  in, not personal data, so none of the sensitivity that argues for discarding
  `resume_text`-adjacent data applies here. Bounded to 10,000 characters by
  `coverLetterInputSchema` (application layer), not by a database check
  constraint — consistent with how `resume_text` and the jsonb columns are
  validated.
- **No unique constraint on `analysis_id`, and no versioning scheme beyond
  "every generation is a new row."** Unlike an ATS audit, where the newest
  supersedes the old one, a cover letter is keyed to a job, not just a resume —
  the same analysis can produce many genuinely different letters for many
  different jobs, all worth keeping at once. A constraint here would let a
  second job's letter overwrite a first, deleting a still-wanted document
  rather than an outdated one.

`public.career_insights` (migration `0005`) — `id`, `analysis_id` (FK to
`resume_analyses`, `on delete cascade`), `user_id` (FK to `auth.users`,
`on delete cascade`), `insights` (jsonb — the whole validated document),
`schema_version` (smallint, default 1), `created_at`. Indexes on
`(analysis_id, created_at desc)` and `(user_id, created_at desc)`. RLS
enabled, INSERT (with the same parent-ownership `exists (…)` clause as
`ats_audits` and `cover_letters`) and SELECT policies, no UPDATE/DELETE.

Two things about that table are deliberate:

- **No numeric column of any kind**, and no copy of `overall_score` or
  `ats_score`. Career Insights is shown both scores as read-only context for
  its reasoning, but is instructed never to reinterpret, explain, or derive a
  new score from them — and `careerInsightsSchema` has no numeric field for
  one to land in, so nothing scorelike can reach the column. That instruction
  is a prompt-level mitigation; the absent column is the structural half.
- **No unique constraint on `analysis_id`** — this follows `ats_audits`, not
  `cover_letters`. Insights for a resume converge on one answer, so the newest
  supersedes the older; there is no second axis (the way a letter is keyed to
  a job) making two concurrent sets legitimately different and both worth
  keeping. Regeneration appends, and readers take the newest.

`public.interview_preps` (migration `0006`) — `id`, `analysis_id` (FK to
`resume_analyses`, `on delete cascade`), `user_id` (FK to `auth.users`,
`on delete cascade`), `prep` (jsonb — the whole validated document),
`schema_version` (smallint, default 1), `created_at`. Indexes on
`(analysis_id, created_at desc)` and `(user_id, created_at desc)`. RLS
enabled, INSERT (with the same parent-ownership `exists (…)` clause as the
other derived tables) and SELECT policies, no UPDATE/DELETE.

Two things about that table are deliberate:

- **No numeric column of any kind**, and no copy of `overall_score` or
  `ats_score`. This goes further than `career_insights`, which is at least
  shown both scores as fenced context: Interview Prep is **not shown them at
  all**. They measure document quality, which says nothing about what a hiring
  manager would ask, and a real interviewer has no access to them either.
  `interviewPrepSchema` has no numeric field, so nothing scorelike can reach
  the column.
- **No unique constraint on `analysis_id`** — follows `ats_audits` and
  `career_insights`. The likely questions for a fixed resume converge on one
  answer; there is no second axis (the way a letter is keyed to a job) making
  two concurrent sets legitimately different. Regeneration appends and readers
  take the newest; "Generate again" exists to give fresh practice material on
  demand rather than to keep a library.

**The derived-document table shape.** `ats_audits`, `career_insights`, and
`interview_preps` share an identical column shape — `analysis_id`, `user_id`,
one jsonb document, `schema_version`, `created_at`, two indexes, and the same
three RLS policies. That is a deliberate convention, and it is **not**
duplication waiting to be collapsed into one table with a `kind`
discriminator. The reason is versioning: `schema_version` describes exactly
one Zod schema, and these documents evolve independently. In a shared table
`schema_version = 2` would be ambiguous about which document it versions, and
that ambiguity worsens with each kind added rather than improving. A fourth
derived document should copy migration `0006` rather than merge into it.

Note this is a different argument from the one that keeps `cover_letters`
separate. That table is separate because a letter's two real inputs and one
output are naturally their own columns, so a shared table would leave half its
columns null. Among the three above the shape genuinely is identical, so
versioning is the whole reason.

Migrations are applied **manually** in the Supabase SQL Editor; there is no
Supabase CLI project in this repo. Every migration must be safe to re-run.

## Development Rules

**Workflow**

- Work sprint-by-sprint. Implement only what the current task specifies — do
  not build ahead.
- Do not make architectural decisions unilaterally (new libraries, state
  management, data layer, folder restructuring) — explain the tradeoff and ask
  first.
- Stop and wait for review at the end of each sprint task.
- Before declaring anything done, run `pnpm format`, `pnpm lint`,
  `pnpm typecheck`, and `pnpm build`, and fix what they surface.
- Verify behavior, not just compilation. A green build has repeatedly hidden
  runtime bugs in this project (see Known Limitations for two that shipped
  this way). When adding a library, read its installed `.d.ts` rather than
  relying on recalled or documented API shapes.

**Architecture**

- `src/app` holds routes only; shared UI lives in `src/components`.
- Never edit generated files in `src/components/ui/` — extend or wrap instead.
- Prefer composition: small, single-purpose components over monoliths.
- Reuse before adding. Shared surfaces already exist (`AuthCard`, `ScoreRing`,
  `DecorativeBackdrop`, `cn`, `safeRedirectPath`, `validateResumeFile`).
- Keep provider-specific code isolated behind a stable function signature, as
  `lib/ai/resume-analysis.ts` does — the Anthropic→Gemini swap touched one file.
- `lib/ai/gemini.ts` is the single entry point for AI generation — every AI
  module calls Gemini through its `requestStructuredJson`, never constructs
  its own client. A schema a client component needs as a value belongs in its
  own `lib/ai/<tool>-schema.ts`, never in the same file as a `./gemini` import
  — see AI Architecture's "Client/server import boundary" for why and how to
  verify it.
- A new AI-backed tool follows the shape of the existing five (Resume
  Analyzer, Resume Optimizer, ATS Compatibility Check, Cover Letter Generator,
  Career Insights) rather than inventing a new one: a prompt + Zod schema in
  `lib/ai/`, a Server Action that re-runs `getUser()` and re-validates input
  server-side, a route that fetches eligibility server-side, and a client
  phase-machine component. Reach for `requestStructuredJson`, `ResumePicker`,
  `DashboardPanel` / `ListPanel`, and `ScoreRing` before writing new
  infrastructure.

**Security**

- Use `getUser()`, never `getSession()`, for any decision about who may see or
  do something.
- Re-validate every Server Action input server-side with the same Zod schema
  the client uses.
- Never expose a server-only secret with a `NEXT_PUBLIC_` prefix.

**Design**

- The Design System PDF governs color, type, spacing, radius, and states.
  Match it rather than improvising.
- Every component must be responsive, accessible (semantic HTML, keyboard
  navigation, ARIA where needed), and production-quality.
- Honor `prefers-reduced-motion` — the codebase uses `motion-reduce:` on every
  transition and animation.
- Do not invent copy, sections, or components not in the reference material.

**Package manager** — always `pnpm`, never npm/yarn. Add shadcn components
with `pnpm dlx shadcn@latest add <component>`.

## Feature Status

**Shipped and verified end to end** — Landing page, Authentication, Dashboard
shell, Resume Analyzer, Resume Optimizer, ATS Compatibility Check, Cover Letter
Generator, Career Insights. See Current Features for what each does and AI
Architecture for how the five AI-backed tools are built.

## Known Limitations

- **The middleware never runs.** `middleware.ts` sits at the repo root, but this
  project keeps its app under `src/`, so Next.js looks for `src/middleware.ts`
  and finds nothing. Confirmed empirically, not inferred: `next build` writes
  `"middleware": {}` / `"sortedMiddleware": []` into
  `.next/server/middleware-manifest.json`, and no middleware compile step
  appears in `next dev`. Consequences — the second layer of `/dashboard`
  protection is absent (the layout guard still holds), `AUTH_ONLY_PATHS` never
  fires so a signed-in user can still open `/sign-in`, and cookie rotation via
  `getUser()` only happens on routes that call it themselves. Found while
  verifying the dashboard shell; **not yet fixed** — moving the file activates
  behaviour that has never actually executed, which deserves its own task.
- **`.doc` is not supported.** The picker accepts `.pdf,.doc,.docx` and
  `validateResumeFile` passes `.doc` through, but extraction rejects it with a
  clear message — no reliable pure-JS extractor exists for the legacy binary
  format. Either narrow the picker to `.pdf,.docx` or add conversion.
- **`ui/button.tsx` has no `"use client"`** and imports Radix's `Slot`.
  Rendering it from a Server Component crashes the build with
  `createContext is not a function`. Every consumer currently declares the
  boundary itself. Fixing it at the source means editing a generated file.
- **No rate limiting on any AI route.** A signed-in user can click Analyze,
  Optimize, "Run a fresh audit", Generate cover letter, or Generate again
  (Career Insights) repeatedly; each click costs an API call, and Analyze,
  audit, cover letter generation, and career insights generation each insert a
  row. Five surfaces now, up from one. The ATS Check's and Career Insights'
  stored-result paths incidentally avoid the cost on re-open, but "Run a fresh
  audit" and "Generate again" are both unthrottled, and every cover letter
  generation is unthrottled by design (see Current Features — there is no
  stored-result path to short-circuit).
- **No history/detail UI.** All four pickers read `resume_analyses` back, and
  the ATS Check and Career Insights read `ats_audits`/`career_insights` back,
  so the SELECT policies are exercised — but these are selection lists, not a
  browsing or detail view of past analyses, audits, insights, or letters. An
  audit or an insights document is re-viewable only by re-selecting its
  analysis in that tool; a cover letter is not re-viewable at all once its
  phase resets, even though `listCoverLetters` (in `cover-letter-action.ts`)
  already exists to support a future list view — it is simply not wired into
  any UI yet.
- **The Optimizer, ATS Check, Cover Letter Generator, and Career Insights only
  see analyses run after `resume_text` shipped.** It is nullable and
  forward-only (migration `0002`); analyses created before that migration have
  no stored resume text and are absent from all four pickers, not shown as
  errors. There is no backfill path — the original text for those rows was
  never retained.
- **The ATS audit and the ATS score can disagree.** They come from separate
  model calls with different inputs — the audit is never shown the score. This
  is a deliberate improvement on two competing _numbers_, but a resume can still
  show a high stored score beside a critical-sounding audit. The provenance
  caption is what keeps that legible; nothing enforces agreement.
- **The audit's "no score" rule is prompt-level, not structural.** `atsAuditSchema`
  has no numeric field, so a score cannot be stored or rendered — but the model
  could still write a number into a prose string like `executiveSummary`. The
  system prompt forbids it explicitly; that is a mitigation, not a guarantee.
- **The cover letter's "no invented facts" rule is prompt-level, not
  structural.** Nothing in `coverLetterSchema` (a single `letter` string) can
  enforce that every claim traces back to the resume text — the prompt's
  three-layer instruction (source-of-truth framing, generalize-don't-invent,
  a closing self-check) is a mitigation, not a guarantee, exactly like the
  Optimizer's fact-preservation instruction.
- **Career Insights' score containment and "no invented facts" rules are
  prompt-level, not structural.** `careerInsightsSchema` has no numeric field,
  so a score cannot be stored or rendered — but the model could still write a
  number, a salary figure, or a market statistic into a prose field like
  `positioning`, or attribute a role fit to a credential the resume doesn't
  show. The system prompt forbids all of this explicitly (see Current
  Features); that is a mitigation, not a guarantee, exactly like the audit's
  no-score rule and the cover letter's/Optimizer's fact-preservation rules.
- **Palette diverges from the Design System PDF.** `globals.css` still carries
  shadcn's neutral tokens rather than the PDF's blue.
- **The analysis prompt was written for Claude** and carried over to Gemini
  unchanged. Scoring calibration has not been tuned against real Gemini output.
- **`maxDuration = 60`** is set on `dashboard/resume-analyzer/page.tsx`,
  `dashboard/resume-optimizer/page.tsx`, `dashboard/ats-checker/page.tsx`,
  `dashboard/cover-letter/page.tsx`, and `dashboard/career-insights/page.tsx`,
  but Vercel's Hobby tier caps functions at 10s regardless — a slow analysis,
  optimization, audit, letter, or insights generation will time out there.
  Five routes now depend on a timeout that tier does not honor.
- **Deep links lose their destination.** `dashboard/layout.tsx` redirects to a
  hardcoded `/sign-in?next=/dashboard`, so a signed-out user opening
  `/dashboard/resume-analyzer` lands on Overview after signing in rather than
  the analyzer. A Server Component cannot read the pathname; the middleware is
  what encodes the real one, and it is inert.
- **PKCE links are browser-bound.** Confirmation and recovery links must be
  opened in the same browser that started the flow, or the code exchange fails
  and the user lands on `/sign-in?notice=link-invalid`.
- **`middleware.ts` does not reliably hot-reload** in `next dev`. After editing
  it, restart the dev server before concluding a change didn't work.

## Environment Variables

Copy `.env.example` to `.env.local`. All three are required — without them
every request fails, since middleware runs on nearly every route.

| Variable                        | Scope      | Source                                        |
| ------------------------------- | ---------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public     | Supabase → Project Settings → API             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public     | Supabase → Project Settings → API             |
| `GEMINI_API_KEY`                | **Server** | Google AI Studio (aistudio.google.com/apikey) |

The two Supabase values are safe in the browser — the anon key is designed to
be public and RLS protects the data. `GEMINI_API_KEY` must never get a
`NEXT_PUBLIC_` prefix.

**Supabase project settings** that the code assumes: email confirmations
enabled; password minimum length 8 (matching the Zod schema); Site URL and
Redirect URLs allowlisting the app origin and `/auth/callback`.

## Important Notes for Future Development

Read this section first in a fresh session.

Nexona is past the scaffolding stage. Authentication, the dashboard shell, and
five AI-backed tools sharing one AI infrastructure layer are all live and
verified end to end. The landing page is complete. There is no planned tool
left in the sidebar's "Coming Soon" group — the next phase is whatever new tool
gets specified, on top of a pattern that now has five examples, and closing
the Known Limitations below.

The most useful thing to understand structurally: **the app shell exists, and
so does the AI tool pattern.** `/dashboard` is a guarded sidebar layout with
Overview at its root and each tool on its own route beneath it. Resume
Analyzer, Resume Optimizer, ATS Compatibility Check, Cover Letter Generator,
and Career Insights are all shipped. Shipping the next one means adding a
route under `dashboard/` and adding its `dashboard-nav-items.ts` entry with
`status: "available"` from the start — nothing structural left to invent.

The shared surfaces to build on before writing anything new: `lib/ai/gemini.ts`
(client, model, structured-JSON call), `ResumePicker` (any tool that operates on
an existing analysis), `DashboardPanel` + `ListPanel` (the card surfaces), and
`ScoreRing`. A sixth tool should be adding a prompt, a schema, an action, and a
route — not new infrastructure, unless it genuinely needs a new input shape the
way Cover Letter Generator needed a job-details form (in which case build it
inline first, the way `CoverLetterJobForm` was, rather than generalizing before
a second consumer exists). If the new tool's client component needs to import
any value from its `lib/ai/` module for form validation, put that value in its
own `<tool>-schema.ts` file first — see AI Architecture's "Client/server import
boundary." Note that the sidebar's "Coming Soon" `SidebarGroup` in
`dashboard-sidebar.tsx` is now conditionally rendered (`comingSoonItems.length

> 0`) precisely because shipping Career Insights emptied it; adding a new
`comingSoon` placeholder before it ships will bring that group back.

One product principle worth not relitigating: **derived tools explain the stored
analysis, they do not re-derive it.** The ATS Check was specified to expand on
the existing ATS score rather than generate its own, because two model calls
legitimately disagree and two numbers for one resume is a broken experience. Any
future tool that is tempted to emit a competing score should carry the same
constraint.

Before building anything new, read the **first** Known Limitation. The
middleware has never executed, which means the documented auth model and the
running one differ. That is the highest-value thing to fix in this codebase and
it is deliberately left open rather than folded into an unrelated task.

Two conventions carry real weight here. First, this project is worked
**sprint-by-sprint with a review gate** — implement the current task, stop,
and wait. Do not build ahead, and do not make architectural calls without
asking. Second, **verify at runtime**. Four separate bugs in this codebase
passed `typecheck` and `build` and failed only when actually executed: a Radix
client-boundary crash, `unpdf` rejecting a Node `Buffer` that satisfied its
TypeScript type, a `pdf-parse` worker that could not resolve, and a client
component pulling `GoogleGenAI`'s server-only construction into the browser
bundle through a shared schema import. Run the thing — and for anything
touching the AI layer, grep the built `.next/static/` output for `GoogleGenAI`
too, since that failure mode is invisible to both type checking and a
successful build.

When adding a dependency, read its shipped type declarations in
`node_modules` before writing the call — the installed API has diverged from
both memory and public docs more than once here.
