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
structure. Result is displayed, not persisted. Deliberately minimal for this
sprint — **no** export, download, version history, side-by-side comparison,
editing, chat, or multiple optimization modes. Only analyses that have a
stored `resume_text` are selectable — see Persistence.

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

**Persistence** — every completed analysis is written to `resume_analyses`,
scoped to its owner by Row Level Security. The uploaded file itself is never
stored. Its extracted text **is** now retained (`resume_text`, added for the
Resume Optimizer) — a deliberate reversal of this table's original design,
which discarded it after analysis. The column is nullable and forward-only:
analyses created before this shipped have no `resume_text` and are simply
absent from the Optimizer's and ATS Check's pickers, not treated as broken.

ATS audits are written to a separate `ats_audits` table rather than onto the
analysis row. That is a security choice, not a modelling one: updating the
analysis row would require an UPDATE policy on `resume_analyses`, and RLS
policies are per-row, not per-column — granting it would let a client rewrite
scores, summary, and `resume_text` too. Both tables stay insert-and-read only.

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

src/components/
  ui/                          shadcn-generated primitives — DO NOT EDIT
                               (present: accordion, button, checkbox, input,
                               label, separator, sheet, sidebar, skeleton,
                               tooltip)
  auth/                        Forms, shared auth UI, auth-actions.ts
  dashboard/                   dashboard-sidebar, dashboard-nav-items, overview,
                               resume-analyzer, resume-dropzone,
                               analysis-results, resume-analyze-action.ts,
                               resume-optimizer, resume-picker,
                               resume-optimization-results,
                               resume-optimize-action.ts,
                               ats-checker, ats-audit-results,
                               ats-audit-action.ts,
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

**Shared AI infrastructure.** `lib/ai/gemini.ts` owns the single `GoogleGenAI`
client, the `MODEL` constant, and `requestStructuredJson` — the call /
empty-text guard / `JSON.parse` / Zod-validate sequence every AI module shares.
Each module keeps its own prompt, Gemini `responseSchema`, and Zod schema.
`JSON.parse` runs before `schema.parse` on purpose: a truncated response must
surface as a `SyntaxError` and a wrong-shaped one as a `ZodError`, because the
Server Actions branch on `error instanceof z.ZodError` to pick their message.
Changing the model is now a one-line edit in one file.

**Database.** Two tables. `public.resume_analyses` — `id`, `user_id` (FK to
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

## Current Sprint Status

**Completed**

- Sprint 1 — project foundation
- Sprint 2A — landing page (all sections)
- Sprint 2B — authentication UI
- Sprint 2C — authentication backend (Supabase)
- Sprint 2D — post-login welcome experience
- Sprint 3 — resume upload experience
- Sprint 4 — Resume Analyzer (AI analysis, persistence, results UI)

**Current** — Sprint 5.

- Task 1 (auth routing) is closed: the attempt to redirect authenticated users
  away from `/` was implemented and then reverted by request. `/` is the public
  landing page for everyone.
- Task 2 (dashboard shell + sidebar navigation) is implemented: shadcn `sidebar`
  block, Overview at `/dashboard`, analyzer at `/dashboard/resume-analyzer`,
  `WelcomeScreen` deleted.
- Sprint 6.1 (dashboard navigation expansion) is implemented: `dashboardNavItems`
  is a discriminated union on `status` (`available` vs `comingSoon`), with
  `ats-checker`, `cover-letter`, and `career-insights` listed in a "Coming Soon"
  `SidebarGroup`.
- Sprint 6.2 (Resume Optimizer foundation) is implemented: `resume_text` added
  to `resume_analyses` (migration `0002`, forward-only), `resume-optimize-action.ts`
  - `lib/ai/resume-optimization.ts` + the optimizer route/components, and
    `resume-optimizer` flipped from `comingSoon` to `available`. Migration
    `0002` has been applied to the live Supabase project, and the signed-in
    flow is verified end to end: a new analysis persists with its
    `resume_text`, and the Optimizer lists and rewrites it.
- Sprint 6.3 (ATS Compatibility Check) is implemented: `lib/ai/gemini.ts`
  extracted and both existing AI modules migrated onto it (behavior-preserving,
  verified — prompts, schemas, request config, and error strings unchanged),
  migration `0003` adding `ats_audits`, `lib/ai/ats-audit.ts` +
  `ats-audit-action.ts` + the route/components, `ResumePicker` generalized to
  serve two tools, `ListPanel` and `DashboardPanel` extracted as shared
  surfaces, and `ats-checker` flipped from `comingSoon` to `available`.
  **The audit is qualitative by design and produces no score** — see Current
  Features.

**Planned** — Cover Letter · Career Insights.

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
  Optimize, or "Run a fresh audit" repeatedly; each click costs an API call, and
  Analyze and audit each insert a row. Three surfaces now, up from one. The ATS
  Check's stored-audit path incidentally avoids the cost on re-open, but
  "Run a fresh audit" is unthrottled.
- **No history/detail UI.** Both pickers read `resume_analyses` back, and the
  ATS Check reads `ats_audits` back, so the SELECT policies are exercised — but
  these are selection lists, not a browsing or detail view of past analyses and
  audits. An audit is re-viewable only by re-selecting its analysis in the ATS
  Check; there is no list of audits as such.
- **The Optimizer and ATS Check only see analyses run after `resume_text`
  shipped.** It is nullable and forward-only (migration `0002`); analyses created
  before that migration have no stored resume text and are absent from both
  pickers, not shown as errors. There is no backfill path — the original text
  for those rows was never retained.
- **The ATS audit and the ATS score can disagree.** They come from separate
  model calls with different inputs — the audit is never shown the score. This
  is a deliberate improvement on two competing _numbers_, but a resume can still
  show a high stored score beside a critical-sounding audit. The provenance
  caption is what keeps that legible; nothing enforces agreement.
- **The audit's "no score" rule is prompt-level, not structural.** `atsAuditSchema`
  has no numeric field, so a score cannot be stored or rendered — but the model
  could still write a number into a prose string like `executiveSummary`. The
  system prompt forbids it explicitly; that is a mitigation, not a guarantee.
- **Palette diverges from the Design System PDF.** `globals.css` still carries
  shadcn's neutral tokens rather than the PDF's blue.
- **The analysis prompt was written for Claude** and carried over to Gemini
  unchanged. Scoring calibration has not been tuned against real Gemini output.
- **`maxDuration = 60`** is set on `dashboard/resume-analyzer/page.tsx`,
  `dashboard/resume-optimizer/page.tsx`, and `dashboard/ats-checker/page.tsx`,
  but Vercel's Hobby tier caps functions at 10s regardless — a slow analysis,
  optimization, or audit will time out there. Three routes now depend on a
  timeout that tier does not honor.
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

Nexona is past the scaffolding stage. Authentication, the resume upload flow,
Gemini-backed analysis, and a Postgres schema with RLS are all live and
verified working end to end. The landing page is complete. Roughly: the
product's first real feature ships, and the next phase is building the app
shell around it.

The most useful thing to understand structurally: **the app shell now exists.**
`/dashboard` is a guarded sidebar layout with Overview at its root and each tool
on its own route beneath it. Resume Analyzer, Resume Optimizer, and ATS
Compatibility Check are all shipped; adding the next feature (Cover Letter,
Career Insights) means adding a route under `dashboard/` and flipping its
`dashboard-nav-items.ts` entry from `comingSoon` to `available` — nothing
structural left to invent. The old `WelcomeScreen` two-state toggle has been
deleted.

The shared surfaces to build on before writing anything new: `lib/ai/gemini.ts`
(client, model, structured-JSON call), `ResumePicker` (any tool that operates on
an existing analysis), `DashboardPanel` + `ListPanel` (the card surfaces), and
`ScoreRing`. A fourth tool should be adding a prompt, a schema, an action, and a
route — not new infrastructure.

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
asking. Second, **verify at runtime**. Three separate bugs in this codebase
passed `typecheck` and `build` and failed only when actually executed: a Radix
client-boundary crash, `unpdf` rejecting a Node `Buffer` that satisfied its
TypeScript type, and a `pdf-parse` worker that could not resolve. Run the
thing.

When adding a dependency, read its shipped type declarations in
`node_modules` before writing the call — the installed API has diverged from
both memory and public docs more than once here.
