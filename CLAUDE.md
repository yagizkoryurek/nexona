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
in depth, generating a matching cover letter, surfacing career insights, and
preparing for the interview the résumé invites.

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

Everything below is implemented and working. See Feature Status for exactly
what "verified" covers and what it does not.

**Landing page** — Navbar (responsive, mobile menu), Hero with static product
preview, Features, How It Works, Pricing (billing toggle), FAQ, Footer.

**Public legal pages** — `/terms` and `/privacy`, in the `(legal)` route group.
They reuse the landing page's own `Navbar` and `Footer` rather than the auth
screens' minimal shell, because these are public, linkable pages a visitor may
land on directly rather than a focused single-task flow. Both are **placeholder
content pending legal review**, and each says so in an italic notice at the top
— they are structurally real routes, not legally reviewed documents. The
footer's Company links (`/about`, `/contact`) are still unbuilt and will 404.

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

**This is the second tool available on mobile**, after the Resume Analyzer —
see AI Architecture's "The mobile surface". It is also the first mobile screen
that opens on a list rather than a file picker, since it acts on an analysis
the user already has.

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

**Interview Preparation** — pick a previously analyzed resume and Gemini
produces the interview that resume implies: an overview of how the candidate
is likely to come across, six to twelve likely questions each carrying the
resume content that prompts it and guidance for answering from the candidate's
own material, talking points worth raising unprompted, and priority-ranked
areas to rehearse. Every question is graded by a closed `category` —
`behavioral`, `technical`, `experience`, or `resumeProbe`. That last one is the
uncomfortable kind (gaps, short tenures, career changes, title regressions),
and the prompt instructs producing them **only where the resume genuinely
invites one** — a continuous, well-explained history should yield few or none,
since manufacturing an awkward question about a clean record would coach the
candidate into over-explaining something no interviewer would raise.
Resume-only by design, same as Career Insights: no target-role, company, or
job-description input. Persisted to `interview_preps`. Re-opening an
already-prepared resume serves the stored document with no model call;
"Generate again" appends a new one.

**Interview Preparation is never shown `overall_score` or `ats_score`, and the
containment is structural rather than prompt-level.** This goes further than
Career Insights, which receives both scores as fenced read-only context. The
reason is relevance, not anchoring risk: the scores measure the résumé as a
document, which says nothing about what a hiring manager would ask, and a real
interviewer has no access to them either. The analysis `suggestions` are
withheld for the same reason — they are about improving the document, not the
interview. The Server Action's `select` fetches only `file_name`,
`resume_text`, `summary`, `strengths`, and `weaknesses`, so **the model cannot
be shown what the query never retrieves**; `interviewPrepSchema` additionally
has no numeric field. `weaknesses` earns its place because it maps closely onto
what an interviewer actually probes.

**Derived arithmetic on explicit résumé facts is permitted and is not
fabrication.** If the résumé states a latency went from 45 minutes to under 4
minutes, the model may describe that as "over a 90% improvement." The figure
does not appear verbatim in the source, but it is computed from two numbers
that do, it is checkable, and it is the framing a candidate would actually use
out loud. This is grounded reasoning, and it is deliberately **not** covered by
the "never invent a professional fact" rule the Optimizer, Cover Letter
Generator, and Career Insights carry. What remains forbidden is any figure with
no arithmetic path back to stated résumé content: scores, ratings, percentages
of "fit" or "readiness", salary figures, and market or demand statistics. The
distinction is computability from the source, not the presence of a digit.

**Account Settings** — `/dashboard/settings`, reached from a link in the
sidebar footer beside Sign Out rather than from `dashboardNavItems`, which
stays a list of Overview plus the six AI tools. Four sections: account
information (email, name, member-since, verification status — all read-only,
since editing either would need new auth behaviour), security, privacy/legal
links to `/privacy` and `/terms`, and a Danger Zone.

The security section's one action is **"Send password reset link"**, which
calls the existing `requestPasswordReset` unchanged — the same action
`/forgot-password` uses. Linking to `/forgot-password` instead would not work:
that path is in the middleware's `AUTH_ONLY_PATHS`, so a signed-in user is
bounced to the dashboard before it renders. The button does not return after a
successful send, because Supabase Auth throttles outgoing mail.

**Delete Account** — in the Danger Zone, gated behind an inline type-`DELETE`-
to-confirm step. Confirmation is inline rather than a modal because there is no
`dialog`/`alert-dialog` primitive in `components/ui/`, and adding one to ask a
single question would introduce a primitive with one consumer. Success clears
the session and redirects to `/sign-in?notice=account-deleted`, a new entry in
the `NOTICES` map that `sign-in-form.tsx` already used for cross-flow handoffs.

Deletion runs entirely through `public.delete_account()` (migration `0009`) —
see Database. **Web only; the mobile app has no deletion UI yet**, which is a
store-policy gap once the app ships (both Apple and Google require in-app
account deletion for apps that support account creation).

**Persistence** — every completed analysis is written to `resume_analyses`,
scoped to its owner by Row Level Security. The uploaded file itself is never
stored. Its extracted text **is** now retained (`resume_text`, added for the
Resume Optimizer) — a deliberate reversal of this table's original design,
which discarded it after analysis. The column is nullable and forward-only:
analyses created before this shipped have no `resume_text` and are simply
absent from the Optimizer's, ATS Check's, Cover Letter Generator's, Career
Insights', and Interview Prep's pickers, not treated as broken.

ATS audits, cover letters, career insights, and interview preparation are each
written to their own separate table (`ats_audits`, `cover_letters`,
`career_insights`, `interview_preps`) rather than onto the analysis row. That
is a security choice, not a modelling one: updating the analysis row would
require an UPDATE policy on `resume_analyses`, and RLS policies are per-row,
not per-column — granting it would let a client rewrite scores, summary, and
`resume_text` too. All five tables stay insert-and-read only. None of the four
are merged into one table either, despite `ats_audits`, `career_insights`, and
`interview_preps` sharing an identical column shape: each of those is one jsonb
document every client reads the same way, but a cover letter's two real inputs
(job title, job description) and one output (the letter) are naturally their
own columns, and a shared table would leave half its columns null depending on
which kind a row was. The three identically-shaped tables stay separate from
each other too — see Database's "derived-document table shape" for why
(versioning, not columns).

## Authentication Flow

Exactly as it behaves today.

**Routes.** `/` (public landing) · `/sign-in` · `/get-started` (sign up) ·
`/forgot-password` · `/reset-password` · `/auth/callback` · `/dashboard`.

**Middleware** (`src/middleware.ts` → `src/lib/supabase/middleware.ts`) is
registered and executes. It runs on a **deliberately narrow matcher** rather
than on every non-static request:

```
/dashboard/:path*  ·  /sign-in  ·  /get-started  ·  /forgot-password  ·  /reset-password
```

`/`, `/terms` and `/privacy` are excluded because they are statically
prerendered and render nothing user-specific — an authenticated visitor to `/`
sees the same landing page as anyone else, so the session is never consulted
there, and paying for a `getUser()` round-trip on the highest-traffic public
route buys nothing. `/auth/callback` is excluded because it performs its own
PKCE code exchange with its own Supabase client; a `getUser()` ahead of that
exchange does no useful work on a request that has no session yet.

On every matched request it calls `supabase.auth.getUser()` — which revalidates
the token against the Auth server and writes rotated cookies onto the response
— then applies two rules:

- `PROTECTED_PREFIXES = ["/dashboard"]` — no session → redirect to
  `/sign-in?next=<path>`.
- `AUTH_ONLY_PATHS = ["/sign-in", "/get-started", "/forgot-password"]` —
  has session → redirect to `/dashboard`.

`/` is deliberately **not** in either list: it is always the public landing
page regardless of session state. An authenticated user visiting `/` sees the
landing page, not a redirect. This was tried and explicitly reverted.

`/reset-password` **is** matched by the matcher but is deliberately **not** in
`AUTH_ONLY_PATHS`: a user arriving from a recovery email _is_ signed in, so
listing it would make the reset flow impossible to complete. It stays matched so
the recovery session's cookies keep rotating while the user types a new
password. That page guards itself instead — it calls `getUser()` and redirects
to `/forgot-password` when there is no session.

**A signed-in user landing on an auth-only page keeps their destination.**
`signedInDestination` (`src/lib/supabase/middleware.ts`) reads the `next` the
link was carrying and sends them there rather than always to Overview, so a deep
link followed while already signed in still arrives where it pointed. It runs
`next` through the same `safeRedirectPath` guard the sign-in action uses, so it
cannot become an open redirect, and a `next` pointing back at an auth-only page
falls back to `/dashboard` — routing someone through the sign-in page to reach
the sign-in page is never what they meant.

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
built-in Origin-header CSRF check. `/dashboard` is guarded **twice** — the
middleware plus a `getUser()` check in `dashboard/layout.tsx` — and both layers
are live. The middleware answers first, so a signed-out deep link is redirected
before the layout renders; the layout check remains as the backstop that holds
even if a route ever falls outside the matcher.

**Security headers** are set in `next.config.ts`'s `headers()` for `/(.*)`, so
they reach every response including redirects and API routes:
`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`. They are deliberately **not** in the
middleware — its matcher excludes `/`, `/terms` and `/privacy`, the pages that
most need clickjacking and referrer protection.

Two things about the CSP are deliberate and easy to "tighten" wrongly:

- **`script-src` carries `'unsafe-inline'`, and removing it breaks the whole
  app.** Next.js streams the RSC payload as inline `self.__next_f.push(...)`
  scripts — 20 on the landing page — so without it every page renders and
  never hydrates. The strict alternative is a per-request nonce, which was
  considered and rejected: nonces are per-request, so `/`, `/terms` and
  `/privacy` would lose static prerendering, and the middleware matcher would
  have to widen to every route. What the policy still buys is that no script
  may load from an external origin, the app cannot be framed, forms cannot
  post off-origin, and `<base>` cannot be hijacked. What it does not buy is
  protection from injected inline script — so the repo-wide absence of
  `dangerouslySetInnerHTML`/`innerHTML` has to stay true for this to hold.
- **`connect-src` is `'self'` only.** The browser never calls Supabase or
  Gemini directly — `src/lib/supabase/client.ts` has no callers at all. Wiring
  that browser client up for a client-side read means adding the Supabase URL
  here, or those calls fail a CSP check.

`'unsafe-eval'` and `ws:` are added **only** when
`process.env.NODE_ENV === "development"`, for Fast Refresh; both are verified
absent from production responses.

## Project Structure

```
supabase/migrations/           SQL, applied manually via Supabase SQL Editor

next.config.ts                 Security headers (headers() → every route).
                               NOT the middleware: its matcher excludes the
                               public pages that most need them

src/middleware.ts              Thin call site → lib/supabase/middleware, plus
                               the matcher. MUST live under src/ — this project
                               keeps its app there, so a root middleware.ts is
                               never registered (see Authentication Flow)

src/app/
  page.tsx                     Public landing page
  (auth)/                      sign-in, get-started, forgot-password,
                               reset-password + shared auth layout
  (legal)/                     terms, privacy + shared layout that reuses the
                               landing Navbar/Footer. Placeholder content
  auth/callback/route.ts       Code exchange for emailed links
  api/mobile/                  Bearer-authenticated endpoints for the Expo app
    resume-analyzer/route.ts   POST multipart — mirrors analyzeResume
    ats-checker/route.ts       POST JSON — mirrors auditResume
  dashboard/                   Protected app shell
    layout.tsx                 getUser() guard + sidebar shell
    page.tsx                   Overview (greeting + entry point)
    resume-analyzer/page.tsx   Resume Analyzer (maxDuration lives here)
    resume-optimizer/page.tsx  Resume Optimizer (maxDuration lives here)
    ats-checker/page.tsx       ATS Compatibility Check (maxDuration lives here)
    cover-letter/page.tsx      Cover Letter Generator (maxDuration lives here)
    career-insights/page.tsx   Career Insights (maxDuration lives here)
    interview-prep/page.tsx    Interview Preparation (maxDuration lives here)
    settings/page.tsx          Account Settings (no maxDuration — no AI call)

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
                               interview-prep-generator,
                               interview-prep-results,
                               interview-prep-action.ts,
                               settings-link, settings-section,
                               password-reset-card, delete-account-card,
                               delete-account-action.ts,
                               delete-account-action.test.ts,
                               dashboard-panel, list-panel
  hero/ features/ pricing/     Landing page sections
  faq/ footer/ navbar/ how-it-works/
  score-ring.tsx               Shared 0–100 ring (landing + analyzer + ATS)
  decorative-backdrop.tsx      Shared backdrop (landing + auth + dashboard)

src/hooks/use-mobile.ts        Generated with the sidebar block — DO NOT EDIT

src/lib/
  supabase/                    client.ts (browser), server.ts (RSC/actions),
                               middleware.ts (session refresh + guards),
                               route-handler.ts (bearer client for api/mobile)
  api/mobile-route.ts          bearerToken, jsonError, rateLimitStatus —
                               transport helpers shared by every mobile route
  ai/gemini.ts                 Shared Gemini client, MODEL, requestStructuredJson
  ai/resume-analysis.ts        Prompt + schemas, requestResumeAnalysis
  ai/resume-optimization.ts    Prompt + schemas, requestResumeOptimization
  ai/ats-audit.ts              Prompt + schemas, requestAtsAudit
  ai/cover-letter.ts           Prompt + Gemini call, requestCoverLetter
  ai/cover-letter-schema.ts    Client-safe Zod schema — imports neither
                               ./gemini nor ./cover-letter (see AI Architecture)
  ai/career-insights.ts        Prompt + schemas, requestCareerInsights
  ai/interview-prep.ts         Prompt + schemas, requestInterviewPrep
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

**Interview Preparation pipeline:**

```
Select → Fetch → (stored prep? serve it) → Generate → Validate → Persist → Render
```

1. **Select** — the same `ResumePicker` under the same eligibility rule as the
   other four. `dashboard/interview-prep/page.tsx` additionally queries
   `interview_preps` for the caller's `analysis_id`s and marks already-prepared
   rows with a "Prep ready" annotation. Resume-only, so no second input phase.
2. **Submit** — `InterviewPrepGenerator` owns the phase machine
   (`select → generating → results`) and calls the `generateInterviewPrep`
   Server Action with the chosen id and a `refresh` flag — the ATS Check's and
   Career Insights' shape, not the Cover Letter Generator's.
3. **Server guard** — re-runs `getUser()`, validates the id is a UUID,
   re-fetches the row itself under RLS. **The `select` here is deliberately
   narrower than every sibling's**: `file_name, resume_text, summary,
strengths, weaknesses` and nothing else. No `overall_score`, no `ats_score`,
   no `suggestions`. This is the structural half of the containment described
   in Current Features — the model cannot be shown what the query never
   fetches, so it does not depend on the prompt holding. A future reader
   "fixing" this select to match the other four tools would silently undo it.
4. **Serve stored** — unless `refresh`, the newest `interview_preps` row is
   read and re-validated with `interviewPrepSchema`. A valid one is returned
   with no model call. Stored jsonb is re-validated on read, not trusted
   because it was valid on write, same reasoning as the ATS Check's and Career
   Insights' caches: a row that no longer parses falls through to fresh
   generation rather than erroring.
5. **Generate** — `requestInterviewPrep` sends Gemini the stored `resume_text`
   plus `summary`, `strengths`, and `weaknesses`. The prompt carries four
   layers: role framing that puts the interview (not the document) in scope and
   forbids résumé-editing advice; grounding that requires `whyAsked` to name
   the specific role, project, skill, date range, or transition prompting the
   question; a containment clause forbidding scores, ratings, salary figures,
   and any named hiring company (none was supplied, so inventing one would make
   the preparation wrong rather than merely generic); and calibration requiring
   honest use of all four categories. Derived arithmetic on stated résumé
   numbers is explicitly allowed — see Current Features.
6. **Validate** — checked against `interviewPrepSchema` (Zod). **All three
   arrays require at least one entry**, which is a third answer to the same
   question rather than a copy of either sibling: the audit omits minimums
   because empty findings are the good outcome, Career Insights spares only
   `skillGaps` because it describes a deficiency, and this schema has **no
   deficiency array at all** — the uncomfortable material lives inside
   `questions` as a `resumeProbe` category, so nothing here has an emptiness
   that would be good news. `questions` is deliberately **not** capped in Zod;
   count shaping (`minItems: "6"`, `maxItems: "12"`) lives in the Gemini
   response schema, since a verbose answer is not invalid data and rejecting it
   after the call is paid for would turn a usable result into an error.
7. **Persist** — one insert into `interview_preps` with `schema_version`. A
   failed insert is logged and the preparation is still returned with
   `persisted: false`, same divergence-and-reasoning as the ATS Check, Cover
   Letter Generator, and Career Insights.
8. **Render** — `InterviewPrepResults` shows the overview, then the questions
   in a **shadcn/Radix `Accordion`** (question plus category badge as the
   trigger; `whyAsked` and `answerGuidance` as the content), then talking
   points and rehearsal areas. The accordion rather than a flat list because
   six to twelve questions each carrying a rationale and guidance is far more
   text than any other results view here, and a flat list produces a page
   nobody reads to the bottom of; `type="multiple"` rather than the FAQ's
   `"single"` because someone rehearsing wants to compare answers side by side.
   Questions sort `experience → technical → behavioral → resumeProbe`, with
   `resumeProbe` **last on purpose** — opening a practice set with the
   uncomfortable questions reads as an accusation. Sorting is applied in the
   component; the model returns its own order. Deliberately **no `ScoreRing`
   and no score anywhere**: this tool is never shown the stored scores, so
   there is nothing to display and nothing to explain.

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

**The mobile surface.** The Expo app in `mobile/` cannot call a Server Action —
it shares no cookie jar with the deployed origin — so each tool it ships needs
an `/api/mobile/*` route. **Two of the six tools have one**: Resume Analyzer
(POST multipart) and ATS Compatibility Check (POST JSON). The other four are
web-only.

Each route **mirrors its Server Action step for step and reuses the same
`lib/ai` functions**, rather than reimplementing anything: same validation,
same RLS-scoped re-fetch, same rate-limit reserve/resolve, same Gemini call,
same persistence, same user-facing error strings. Note this is function-level
reuse with sequence-level duplication — a change to a tool's flow has to be
made in both the action and the route. The route form differs in exactly three
ways: bearer auth instead of cookies (`lib/supabase/route-handler.ts`), an HTTP
status alongside each error (`rateLimitStatus`, plus `Retry-After` — which the
Server Actions discard), and an outer `try/catch` the actions do not have.

Transport helpers common to every mobile route live in
`lib/api/mobile-route.ts`. They started route-local in the analyzer endpoint and
moved when the ATS route became the second consumer.

**The app reads `resume_analyses` and `ats_audits` directly from Supabase**
(`mobile/src/lib/analyses.ts`), rather than through a route. That is deliberate
and is the one place the app touches a table. The routes exist because AI
generation needs the server-only `GEMINI_API_KEY`; a plain read of the caller's
own rows needs no secret, and RLS already scopes it — the same policy the web
picker depends on. A proxy route would add a server hop to re-permit a read the
client is already entitled to. Anything needing a secret still goes through a
route.

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

**Account deletion** (migration `0009`) — `public.delete_account()`, a
`SECURITY DEFINER` function owned by `postgres`. It adds **no table, no column,
and no policy**.

Five things about it are deliberate and must not be "simplified":

- **It takes no parameters.** Identity comes only from `auth.uid()`, so there
  is no argument for a caller to point at another account. Deleting someone
  else's data is impossible by construction, not by policy. Do not add a
  `p_user_id`.
- **`set search_path = ''`**, not `public` as in `0007`. This function runs
  with BYPASSRLS against `auth.users`, so a shadowing object in an
  earlier-resolving schema would be shadowing identifiers inside the most
  privileged function in the database. Every identifier in it is
  schema-qualified.
- **No service-role key.** `auth.users` is owned by `supabase_auth_admin` and
  grants DELETE to only three roles, `postgres` among them, and `postgres`
  carries BYPASSRLS — so a definer function owned by `postgres` can delete the
  row without introducing a key that bypasses RLS on every table for every
  user. The repo still contains no service-role key anywhere.
- **No DELETE policies were added.** Every user-owned table already cascades
  from `auth.users`, so one row removal takes all six with it. Granting
  row-level DELETE instead would take six policies, would not remove the
  `auth.users` row anyway, and would break the AI rate limiter, whose whole
  guarantee is that a user cannot delete their own `'started'` rows to reset a
  quota. The function **bypasses** RLS rather than relaxing it, so the "no
  UPDATE or DELETE policy on any table" property survives intact.
- **It must be applied as `postgres`** — which the SQL Editor uses. Applied as
  any other role it would be created successfully and then fail at call time.

One honest consequence: deleting an account drops that user's
`ai_usage_events` rows too, so an AI quota can be reset by deleting the account
and signing up again. That is not a regression the function introduces —
signing up with a second address always did the same — and the price is the
irreversible loss of every stored document.

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
- A new AI-backed tool follows the shape of the existing six (Resume Analyzer,
  Resume Optimizer, ATS Compatibility Check, Cover Letter Generator, Career
  Insights, Interview Preparation) rather than inventing a new one: a prompt +
  Zod schema in `lib/ai/`, a Server Action that re-runs `getUser()` and
  re-validates input server-side, a route that fetches eligibility
  server-side, and a client phase-machine component. Reach for
  `requestStructuredJson`, `ResumePicker`, `DashboardPanel` / `ListPanel`, and
  `ScoreRing` before writing new infrastructure.
- **Withhold at the query, not just in the prompt.** When a tool should not see
  a stored field, leave it out of the Server Action's `select` rather than
  relying on a prompt instruction to ignore it. Interview Prep is the reference
  case (see its pipeline, step 3): prompt-level fencing is a mitigation, an
  unfetched column is a guarantee.

**Local Development**

Four operational rules, each learned by losing time to it.

- **Always browse `http://localhost:3000`. Never the `Network:` LAN URL** that
  `next dev` also prints. Auth actions build their emailed links from the
  request's `Origin`, so browsing at `http://192.168.x.x:3000` asks Supabase to
  redirect back to an origin that is not on the Redirect URLs allowlist.
  Supabase then **silently discards `redirect_to` and falls back to the Site
  URL** — the emailed link lands on `/` and `/auth/callback` is never reached.
  `127.0.0.1:3000` is allowlisted too; the LAN IP is not. See Environment
  Variables for the allowlist contract.
- **Run exactly one `next dev` at a time.** Concurrent dev servers are a real
  hazard: they share one `.next` directory, and the second to start takes a port
  like 3001 while both write to the same build output. That can leave stale or
  conflicting artifacts. The failures observed here were a 404 on
  `/_next/static/css/app/layout.css` with an empty `.next/static/css/`, an
  `InvariantError: Expected clientReferenceManifest to be defined`, and a
  `500` on `/`. Check with `pgrep -f "next dev"` before starting one.
- **Never run `pnpm build` while `next dev` is running**, and vice versa. Same
  shared `.next`, same hazard. Stop the dev server, build, then restart it.
- **`.next` is disposable.** It is gitignored (`.gitignore:17`) with zero
  tracked files, so `rm -rf .next` is the reliable reset when the build output
  is suspect, and it touches no source and no git state.

A symptom worth recognising, because it looks like an application bug and is
not: when `.next` is in a bad state the client bundle fails to hydrate, React
never takes over the forms, and a submit becomes a **native browser GET**. The
dev log then shows `GET /forgot-password?email=…` instead of
`POST /forgot-password`, which means the Server Action never ran at all — no
email was sent, nothing reached Supabase. `POST` vs `GET` on a form route is
therefore a fast hydration check.

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

**Shipped** — Landing page, public legal pages, Authentication, Dashboard
shell, Resume Analyzer, Resume Optimizer, ATS Compatibility Check, Cover Letter
Generator, Career Insights, Interview Preparation, Account Settings (including
web Delete Account). See Current Features for what each does and AI
Architecture for how the six AI-backed tools are built.

**On mobile, two of the six tools have shipped**: Resume Analyzer and ATS
Compatibility Check.

**The mobile ATS Check is verified short of an authenticated run.** Both
projects pass `format`/`lint`/`typecheck`/`build`, the `.next/static/`
Gemini-bundle check is clean, a production iOS bundle builds and contains the
screen, and the route's unauthenticated matrix is confirmed by `curl`
(no header → 401, non-bearer scheme → 401, garbage token → 401, `GET` → 405).
**Not yet run: any call carrying a real session**, which is what would exercise
the UUID-validation, not-found, cache-hit, fresh-generation, quota, and
persistence branches. The `QA_EMAIL`/`QA_PASSWORD` in `.env.local` no longer
authenticate, and no replacement was created. The signed-in click-through on a
device is also still pending — that is the step no harness here covers.

**Delete Account is verified only as far as static analysis reaches.** Its
migration and Server Action are covered by
`delete-account-action.test.ts` — no-parameter signature, `auth.uid()`-only
identity, `search_path = ''`, the revoke/grant pair, no policies, no
service-role, and an argument-free `.rpc()` call — and those assertions were
mutation-tested to confirm they fail when each property is violated. The
plpgsql body was parsed and validated against the live database via a
session-local `pg_temp` function, which persists nothing. **The migration has
not been applied**, so the function does not yet exist in `public`, and no
end-to-end deletion has been executed against a real account.

**On what "verified" means here.** Every tool has passed `format`, `lint`,
`typecheck`, `build`, the `.next/static/` Gemini-bundle check, a live model
call against its real prompt and schema, and a signed-out route-guard check.
The signed-in click-through — first generation, cache hit, regenerate, empty
state — has been performed manually by the maintainer, and is the one step no
automated harness in this repo covers. There is no test suite; see Known
Limitations.

**The authentication layer additionally has its own verification record**, from
the sprint that activated the middleware: the compiled-matcher proof (12/12),
the PKCE HTTP matrix (13/13), the authenticated route matrix (21/21), and
tool-route content assertions behind live middleware (6/6). Both browser-bound
PKCE flows — sign-up confirmation and password recovery — were completed
manually end to end and corroborated server-side, recovery from the dev log's
request sequence and sign-up from the `auth.users` timing (`created_at` →
`confirmation_sent_at` → `email_confirmed_at` → `last_sign_in_at`). See
Important Notes for the routine that produced these.

## Known Limitations

- **`.doc` is not supported.** The picker accepts `.pdf,.doc,.docx` and
  `validateResumeFile` passes `.doc` through, but extraction rejects it with a
  clear message — no reliable pure-JS extractor exists for the legacy binary
  format. Either narrow the picker to `.pdf,.docx` or add conversion.
- **`ui/button.tsx` has no `"use client"`** and imports Radix's `Slot`.
  Rendering it from a Server Component crashes the build with
  `createContext is not a function`. Every consumer currently declares the
  boundary itself. Fixing it at the source means editing a generated file.
- **No history/detail UI.** All five pickers read `resume_analyses` back, and
  the ATS Check, Career Insights, and Interview Prep read their own tables
  back, so the SELECT policies are exercised — but these are selection lists,
  not a browsing or detail view of past analyses, audits, insights, preparation
  sets, or letters. A derived document is re-viewable only by re-selecting its
  analysis in that tool; a cover letter is not re-viewable at all once its
  phase resets, even though `listCoverLetters` (in `cover-letter-action.ts`)
  already exists to support a future list view — it is simply not wired into
  any UI yet.
- **The source of a served result is tracked but never shown.** Every cached
  tool's Server Action returns `source: "stored" | "fresh"`, and no results
  view renders it, so a user cannot tell a cache hit from a fresh generation
  except by how long it took. Surfacing it would be a reasonable improvement,
  but it should land in all three cached tools at once rather than one.
- **The Optimizer, ATS Check, Cover Letter Generator, Career Insights, and
  Interview Prep only see analyses run after `resume_text` shipped.** It is
  nullable and forward-only (migration `0002`); analyses created before that
  migration have no stored resume text and are absent from all five pickers,
  not shown as errors. There is no backfill path — the original text for those
  rows was never retained.
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
- **Interview Prep's grounding rule is prompt-level; only its score
  containment is structural.** Withholding the scores at the `select` and
  omitting numeric fields from `interviewPrepSchema` genuinely prevent a stored
  score. Nothing structural, however, stops the model from writing a salary
  figure into prose, naming a hiring company it was never told about, or
  attributing an achievement the résumé does not contain. The system prompt
  forbids each explicitly; that half is a mitigation, not a guarantee. Note
  that derived arithmetic on stated résumé numbers is **permitted** and is not
  a violation of this rule — see Current Features for where the line sits.
- **The test suite is thin and covers no runtime behaviour.** `pnpm test` runs
  Node's built-in runner (`node:test` + `--experimental-strip-types`) over
  `src/**/*.test.ts` — there is still no Vitest, Jest, Playwright or Cypress,
  and adding one remains its own decision. Two files exist:
  `resume-text-extraction.test.ts` (pure string logic plus a migration-matches-
  constant check) and `delete-account-action.test.ts` (static assertions over
  SQL and Server Action **source text**). Neither executes a query, renders a
  component, or calls Gemini. Everything else is still
  `format`/`lint`/`typecheck`/`build`, throwaway per-sprint harnesses, and
  manual click-through.
- **Palette diverges from the Design System PDF.** `globals.css` still carries
  shadcn's neutral tokens rather than the PDF's blue.
- **The analysis prompt was written for Claude** and carried over to Gemini
  unchanged. Scoring calibration has not been tuned against real Gemini output.
- **`maxDuration = 60`** is set on `dashboard/resume-analyzer/page.tsx`,
  `dashboard/resume-optimizer/page.tsx`, `dashboard/ats-checker/page.tsx`,
  `dashboard/cover-letter/page.tsx`, `dashboard/career-insights/page.tsx`, and
  `dashboard/interview-prep/page.tsx`, but Vercel's Hobby tier caps functions
  at 10s regardless — a slow analysis, optimization, audit, letter, insights,
  or interview-prep generation will time out there. Six routes now depend on a
  timeout that tier does not honor.
- **PKCE links are browser-bound, and origin-bound.** Confirmation and recovery
  links must be opened in the same browser that started the flow, or the code
  exchange fails and the user lands on `/sign-in?notice=link-invalid`. The
  reason is that the PKCE **code verifier is stored in a cookie scoped to the
  origin that began the flow**, so the callback must be reached on that same
  origin — which is a second, independent reason never to start a flow on the
  LAN URL (see Development Rules → Local Development). `dashboard/layout.tsx`
  still redirects to a hardcoded `/sign-in?next=/dashboard`, but the middleware
  answers first and encodes the real path, so deep links keep their destination
  in practice.
- **Supabase Auth email sending is rate limited, and the sign-up form hides
  it.** This holds regardless of email provider: custom SMTP (now configured
  via Brevo) changes who delivers the email, not whether Supabase Auth throttles
  how many it will send. The built-in provider's limit is a couple of sends per
  hour on a free project; with custom SMTP configured, Supabase's own default
  is higher and adjustable under Authentication → Rate Limits in the
  dashboard — the exact number isn't pinned here since it's a dashboard setting,
  not something this repository controls or verifies. Once exhausted, `/signup`
  and `/recover` still return `429` with `error_code:
over_email_send_rate_limit`, and no user row is created for a rejected
  sign-up. `signUp` maps every error other than `user_already_exists` to
  "Something went wrong. Please try again." — so a throttled user is told to
  retry, which consumes further attempts. Handling that code with an honest
  message is still a worthwhile fix and remains Sprint 10.4 scope. Testing
  several auth flows in one sitting can still hit this.
- **`src/middleware.ts` does not reliably hot-reload** in `next dev`. After
  editing it, restart the dev server before concluding a change didn't work.

## Environment Variables

Copy `.env.example` to `.env.local`. All three are required. The two Supabase
values are read by the middleware and by every route that touches auth or data —
which is the whole dashboard, every Server Action, and the auth screens — so the
app is unusable without them. `GEMINI_API_KEY` is needed by every AI tool.

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

**The allowlist contract, because getting it wrong fails silently.** `signUp`
and `requestPasswordReset` build their `emailRedirectTo` / `redirectTo` from the
request's own `Origin` (the `origin()` helper in `auth-actions.ts`), which is
correct for production — the deployed origin must be used, so hardcoding one
would break Vercel. Supabase then checks that URL against **Redirect URLs**, and
if it does not match it **discards the value and substitutes the Site URL**, with
no error to the caller. The emailed link therefore appears to work but delivers
the user to the Site URL's root instead of `/auth/callback`, and the flow dies
with no server-side trace, because the app is never reached.

Currently allowlisted for local work: `http://localhost:3000` and
`http://127.0.0.1:3000`. The machine's LAN address is **not**, which is why
Local Development requires `localhost`. Adding `http://192.168.x.x:3000/**`
would enable LAN testing (from a phone, say) but is brittle — DHCP reassigns
that address.

Resolution can be checked without waiting for an email: request
`/auth/v1/verify?token=<anything>&type=recovery&redirect_to=<candidate>` against
the project and read the `Location` header. Supabase resolves `redirect_to`
before it validates the token, so an allowlisted URL is echoed back while a
rejected one is replaced by the Site URL.

## Important Notes for Future Development

Read this section first in a fresh session.

Nexona is past the scaffolding stage. Authentication, the dashboard shell, and
six AI-backed tools sharing one AI infrastructure layer are all live. The
landing page and the public legal pages are complete. There is no planned tool
left in the sidebar's "Coming Soon" group — the next phase is whatever new tool
gets specified, on top of a pattern that now has six examples, and closing the
Known Limitations below.

The most useful thing to understand structurally: **the app shell exists, and
so does the AI tool pattern.** `/dashboard` is a guarded sidebar layout with
Overview at its root and each tool on its own route beneath it. Resume
Analyzer, Resume Optimizer, ATS Compatibility Check, Cover Letter Generator,
Career Insights, and Interview Preparation are all shipped. Shipping the next
one means adding a route under `dashboard/` and adding its
`dashboard-nav-items.ts` entry with `status: "available"` from the start —
nothing structural left to invent.

The shared surfaces to build on before writing anything new: `lib/ai/gemini.ts`
(client, model, structured-JSON call), `ResumePicker` (any tool that operates on
an existing analysis), `DashboardPanel` + `ListPanel` (the card surfaces),
`ScoreRing`, and `ui/accordion.tsx` (for output too dense to read as a flat
list — it carries its own `"use client"`, unlike `ui/button.tsx`). A seventh
tool should be adding a prompt, a schema, an action, and a route — not new
infrastructure, unless it genuinely needs a new input shape the way Cover
Letter Generator needed a job-details form (in which case build it inline
first, the way `CoverLetterJobForm` was, rather than generalizing before a
second consumer exists). If the new tool's client component needs to import any
value from its `lib/ai/` module for form validation, put that value in its own
`<tool>-schema.ts` file first — see AI Architecture's "Client/server import
boundary." Note that the sidebar's "Coming Soon" `SidebarGroup` in
`dashboard-sidebar.tsx` is conditionally rendered on
`comingSoonItems.length > 0`, precisely because shipping Career Insights
emptied it; adding a new `comingSoon` placeholder before it ships will bring
that group back.

**How a new AI tool actually gets verified**, since a green build proves very
little here (see the four runtime-only bugs below). The routine that has caught
real problems, in order:

1. A **throwaway harness** in the scratchpad that calls the real `request*`
   function against Gemini with a seeded résumé, then asserts on the result.
   This is the only thing that proves Gemini accepts the `responseSchema` at
   all — `minItems`/`maxItems` are strings in that API, and a wrong shape fails
   at call time, invisibly to `tsc`. Seed the fixture with the condition you
   want to test: Interview Prep's harness used a résumé with a deliberate
   14-month gap and a 7-month tenure, and confirmed the model raised both as
   separate `resumeProbe` questions rather than trusting that it would.
2. **Assert on calibration, not just shape.** Category spread, count in range,
   forbidden-pattern regexes for scores and salary figures, and a token check
   that every grounding field references real résumé content.
3. **`grep -rl "GoogleGenAI" .next/static/`** after building — must be empty.
4. **Render the results component for real** if it uses a primitive the app
   hasn't exercised. A temporary `"use client"` page rendering the component
   with fixed data, fetched over HTTP and grepped for markers and ordering,
   catches client-boundary crashes and sort bugs; delete it immediately after,
   and re-run `typecheck` **after** the next build, since `.next/types` holds
   stale references to a deleted route until it regenerates.
5. **Anon-key RLS probe** against a new table: `SELECT` must return `[]` and
   `INSERT` must be rejected by policy. Note the PostgREST schema endpoint
   rejects the anon key, so column defaults and nullability cannot be
   introspected from outside — those need a catalog query in the SQL Editor.
6. **Signed-out route guard** via `curl` — expect `307` to `/sign-in`.

The signed-in click-through is manual. Everything above is scriptable and
should be scripted.

**How the authentication layer gets verified**, which is a different routine
because the failure modes are routing and cookies rather than model output:

1. **Prove the matcher against the compiled manifest, not the source config.**
   Read `.next/server/middleware-manifest.json` after `next build` and run its
   `matchers[].regexp` against candidate paths. This is what catches an
   unregistered middleware — `sortedMiddleware: []` means it never runs. It
   **requires a production build**: `next dev` writes an empty middleware
   manifest, so the same check against a dev build proves nothing. Always assert
   positive controls alongside the exclusions; a matcher that matched nothing
   would otherwise pass every "must be excluded" case.
2. **Drive the HTTP matrix with a real cookie jar.** Sign in through
   `createServerClient` with an in-memory `Map` for cookies, then replay them on
   `fetch`. Letting `@supabase/ssr` produce the cookies tests the actual chunked
   format the middleware parses, rather than a hand-rolled guess at it. Assert on
   status **and** `Location`, since a wrong-but-present redirect is the likely
   bug.
3. **Distinguish middleware from the layout guard.** Some results only the
   middleware can produce: an authenticated `GET /sign-in` returning `307` (the
   layout never runs there), and a signed-out `GET /dashboard/<tool>` whose
   `next` carries the real nested path (the layout hardcodes `/dashboard`).
   Those two are the proof it is genuinely executing.
4. **Probe `redirect_to` resolution without an inbox** — see Environment
   Variables. Cheap, repeatable, and the only way to test the allowlist without
   spending a rate-limited email.
5. **Read the dev log for `POST` vs `GET` on form routes.** A `GET` with the
   field in the query string means hydration failed and the Server Action never
   ran, so nothing reached Supabase. Without this check a broken build looks
   exactly like a broken feature.
6. **Confirm manual PKCE flows server-side rather than trusting the browser.**
   Recovery leaves a legible sequence in the dev log
   (`POST /forgot-password` → `GET /auth/callback?code=…&next=%2Freset-password`
   → `GET /reset-password 200` → `POST /reset-password 303` →
   `GET /sign-in?notice=reset-success`). Sign-up confirmation is legible in
   `auth.users` timing: `created_at` → `confirmation_sent_at` →
   `email_confirmed_at` → `last_sign_in_at`.

Reserve the emails. Both browser-bound flows cost a send, and the rate limit is
low enough that a few iterations exhaust it — so get the scriptable checks green
first, then spend an email once.

One environment quirk worth knowing: this repo lives under a synced folder, and
the sync client periodically leaves duplicates inside `.next/`. TypeScript picks
them up from `.next/types` and reports `Duplicate identifier` errors that point
at no real source file.

The duplicates come in two shapes, and an earlier version of this note only
covered one. Files appear as `* 2.*` (`route 2.js`), but **whole directories
appear too, with no dot at all** — `cache 2`, `static 2`, `server 2`, `types 2`,
`chunks 3` have all been observed, and the suffix is not always ` 2`. So
`find .next -name "* 2.*" -delete` matches the files and silently misses every
directory. Use a pattern that covers both:

```
find .next \( -name "* [0-9]" -o -name "* [0-9].*" \) -exec rm -rf {} +
```

They regenerate quickly — copies reappeared within a minute of a fresh build —
so treat this as recurring housekeeping, not a one-time fix. When the build
output is broadly suspect, `rm -rf .next` is more reliable than pruning
duplicates (see Development Rules → Local Development).

One product principle worth not relitigating: **derived tools explain the stored
analysis, they do not re-derive it.** The ATS Check was specified to expand on
the existing ATS score rather than generate its own, because two model calls
legitimately disagree and two numbers for one resume is a broken experience. Any
future tool that is tempted to emit a competing score should carry the same
constraint.

The middleware is now live, and the documented auth model matches the running
one — that gap is closed, and both Known Limitations describing it have been
retired. Two things about it are worth not undoing by accident: the file **must**
stay at `src/middleware.ts` (a root `middleware.ts` is never registered in a
`src/`-based project, which is how it sat inert for several sprints), and the
matcher is **deliberately narrow** rather than a catch-all, because every matched
request costs a `getUser()` round-trip. Widening it to `/` would buy nothing and
add latency to the highest-traffic public route.

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
