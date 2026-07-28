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

**Resume Analyzer** — drag-and-drop or click-to-browse upload, client and
server validation, text extraction, Gemini analysis, persistence, results UI.
Supported formats: **PDF** and **DOCX** (`.doc` is not — see Known
Limitations). Max upload 10 MB (`MAX_RESUME_SIZE_BYTES`).

**Analysis output** — Overall Score (0–100), ATS Score (0–100), a one-sentence
summary, and lists of Strengths, Weaknesses, and Suggestions.

**Persistence** — every completed analysis is written to `resume_analyses`,
scoped to its owner by Row Level Security. The uploaded file itself is never
stored: its text is extracted in memory and discarded.

## Authentication Flow

Exactly as it behaves today.

**Routes.** `/` (public landing) · `/sign-in` · `/get-started` (sign up) ·
`/forgot-password` · `/reset-password` · `/auth/callback` · `/dashboard`.

**Middleware** (`middleware.ts` → `src/lib/supabase/middleware.ts`) runs on
every non-static request. It calls `supabase.auth.getUser()` — which
revalidates the token against the Auth server and writes rotated cookies onto
the response — then applies two rules:

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
built-in Origin-header CSRF check. `/dashboard` is guarded twice — middleware
plus a `getUser()` check in `dashboard/layout.tsx` — so a routing change alone
cannot expose it.

## Project Structure

```
middleware.ts                  Thin call site → lib/supabase/middleware
supabase/migrations/           SQL, applied manually via Supabase SQL Editor

src/app/
  page.tsx                     Public landing page
  (auth)/                      sign-in, get-started, forgot-password,
                               reset-password + shared auth layout
  auth/callback/route.ts       Code exchange for emailed links
  dashboard/                   Protected: layout.tsx guards, page.tsx renders

src/components/
  ui/                          shadcn-generated primitives — DO NOT EDIT
                               (present: accordion, button, checkbox, input, label)
  auth/                        Forms, shared auth UI, auth-actions.ts
  dashboard/                   welcome-screen, resume-analyzer, resume-dropzone,
                               analysis-results, resume-analyze-action.ts
  hero/ features/ pricing/     Landing page sections
  faq/ footer/ navbar/ how-it-works/
  score-ring.tsx               Shared 0–100 ring (landing + analyzer)
  decorative-backdrop.tsx      Shared backdrop (landing + auth + dashboard)

src/lib/
  supabase/                    client.ts (browser), server.ts (RSC/actions),
                               middleware.ts (session refresh + guards)
  ai/resume-analysis.ts        Gemini client, schema, requestResumeAnalysis
  resume-file.ts               Extension + size validation (shared client/server)
  resume-text-extraction.ts    PDF (unpdf) + DOCX (mammoth) → text
  auth-redirect.ts             safeRedirectPath, DEFAULT_AUTHENTICATED_PATH
  utils.ts                     cn()

src/types/mammoth.d.ts         Local ambient types (mammoth ships none)
```

Note: the Resume Analyzer is **not** its own route. `/dashboard` renders
`WelcomeScreen`, which has two in-place states — a welcome panel, and the
analyzer workspace behind a "Continue" button. A real dashboard with sidebar
navigation is planned, not built.

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
7. **Persist** — one insert into `resume_analyses`. RLS enforces ownership.
8. **Render** — `AnalysisResults` displays two `ScoreRing`s plus the three
   lists, with "Analyze another resume" to reset.

**Database.** One table, `public.resume_analyses` — `id`, `user_id` (FK to
`auth.users`, `on delete cascade`), `file_name`, `overall_score`, `ats_score`
(both `check between 0 and 100`), `summary`, `strengths`/`weaknesses`/
`suggestions` (jsonb), `created_at`. RLS enabled with INSERT and SELECT
policies scoped to `authenticated`, plus an index on
`(user_id, created_at desc)`. No UPDATE/DELETE policy — with RLS on, the
absence of a policy is the denial.

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

**Current** — Sprint 5. Task 1 (auth routing) is closed: the attempt to
redirect authenticated users away from `/` was implemented and then reverted
by request. `/` is the public landing page for everyone.

**Planned** — Dashboard · Sidebar Navigation · Resume Optimizer · ATS Checker
· Cover Letter · Career Insights.

## Known Limitations

- **`.doc` is not supported.** The picker accepts `.pdf,.doc,.docx` and
  `validateResumeFile` passes `.doc` through, but extraction rejects it with a
  clear message — no reliable pure-JS extractor exists for the legacy binary
  format. Either narrow the picker to `.pdf,.docx` or add conversion.
- **`ui/button.tsx` has no `"use client"`** and imports Radix's `Slot`.
  Rendering it from a Server Component crashes the build with
  `createContext is not a function`. Every consumer currently declares the
  boundary itself. Fixing it at the source means editing a generated file.
- **No rate limiting on analysis.** A signed-in user can click Analyze
  repeatedly; each click costs an API call and inserts a row.
- **Analyses are written but never read back.** There is no history UI, so the
  SELECT policy on `resume_analyses` is currently unexercised.
- **Palette diverges from the Design System PDF.** `globals.css` still carries
  shadcn's neutral tokens rather than the PDF's blue.
- **The analysis prompt was written for Claude** and carried over to Gemini
  unchanged. Scoring calibration has not been tuned against real Gemini output.
- **`maxDuration = 60`** is set on `dashboard/page.tsx`, but Vercel's Hobby
  tier caps functions at 10s regardless — a slow analysis will time out there.
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

The most useful thing to understand structurally: **there is no dashboard
yet.** `/dashboard` is a single page whose component toggles between a welcome
card and the analyzer. Sidebar navigation and separate tool routes are the
planned next step, and every planned feature (Optimizer, ATS Checker, Cover
Letter, Career Insights) will need somewhere to live. Expect the
`WelcomeScreen` two-state pattern to be replaced rather than extended.

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
