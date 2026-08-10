# Nexona

**AI-powered résumé analysis and application toolkit.**

Nexona reads a résumé the way a recruiter and an applicant tracking system
would, then turns that read into specific, actionable work: a scored analysis,
a rewritten résumé, a deep ATS audit, a targeted cover letter, career
direction, and the interview the résumé invites. Every tool builds on one
stored analysis rather than re-deriving it, so the advice stays consistent
across the whole toolkit.

Built for students, recent graduates, working professionals, and career
changers — anyone applying and not hearing back.

**Built with** Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · Supabase
· Google Gemini

> **Status:** preparing for the first public Beta. The core toolkit is complete
> and running locally; deployment is still in progress, so there is no live URL
> yet. Development is ongoing — see [Roadmap](#roadmap).
>
> **Pricing is not active.** Every tool is free during the Beta. There is no
> billing, no payment step, and no subscription anywhere in the product. Paid
> plans will come later.

---

## Features

Six AI-backed tools, all shipped and working.

| Feature                     | What it does                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resume Analyzer**         | Upload a PDF or DOCX. Returns an overall score, an ATS score, a summary, and specific strengths, weaknesses, and suggestions.                  |
| **Resume Optimizer**        | Rewrites a previously analyzed résumé for wording and structure while preserving every factual detail — employers, titles, dates, credentials. |
| **ATS Compatibility Check** | A qualitative audit: formatting, section structure, keywords, and readability, plus present/missing keywords, parsing blockers, and fixes.     |
| **Cover Letter Generator**  | Takes a job title, optional company, and job description, and writes a letter grounded entirely in the résumé's own content.                   |
| **Career Insights**         | Assesses professional position: strength themes with evidence, roles the résumé already supports, skill gaps, and prioritized next steps.      |
| **Interview Preparation**   | The interview the résumé implies — 6–12 likely questions with the résumé content prompting each, answer guidance, talking points, and drills.  |

Supporting the tools: Supabase email/password **authentication** with
confirmation and password reset, a guarded **dashboard shell** with persistent
sidebar navigation, and public **legal pages** (`/terms`, `/privacy` —
placeholder content pending legal review).

**Two design rules run through every AI tool.** Derived tools _explain_ the
stored analysis rather than re-deriving it, so no tool emits a second score
that could contradict the first. And every claim must trace back to the
résumé — the prompts forbid inventing an employer, title, credential, or
achievement that isn't already there.

---

## Screenshots

Not yet captured. The intended set is listed here — every row is a real screen
that exists today — so images can be dropped in without restructuring the
README.

| View                    | Route                         | Status  |
| ----------------------- | ----------------------------- | ------- |
| Landing Page            | `/`                           | Pending |
| Dashboard Overview      | `/dashboard`                  | Pending |
| Resume Analyzer         | `/dashboard/resume-analyzer`  | Pending |
| ATS Compatibility Check | `/dashboard/ats-checker`      | Pending |
| Cover Letter Generator  | `/dashboard/cover-letter`     | Pending |
| Interview Preparation   | `/dashboard/interview-prep`   | Pending |
| Career Insights         | `/dashboard/career-insights`  | Pending |
| Resume Optimizer        | `/dashboard/resume-optimizer` | Pending |

<!--
Add images to docs/screenshots/ and replace the table above, e.g.:
![Resume Analyzer](docs/screenshots/resume-analyzer.png)
-->

---

## Tech Stack

| Area            | Choice                                                             |
| --------------- | ------------------------------------------------------------------ |
| Framework       | [Next.js 15](https://nextjs.org) (App Router), React 19            |
| Language        | TypeScript (strict)                                                |
| Styling         | Tailwind CSS v4                                                    |
| Components      | [shadcn/ui](https://ui.shadcn.com) on Radix UI, Lucide icons       |
| Auth & database | [Supabase](https://supabase.com) (`@supabase/ssr`, Postgres + RLS) |
| AI              | [Google Gemini](https://ai.google.dev) (`@google/genai`)           |
| Document text   | `unpdf` (PDF), `mammoth` (DOCX)                                    |
| Forms           | react-hook-form + Zod                                              |
| Tooling         | ESLint 9 (flat config), Prettier 3                                 |
| Package manager | pnpm                                                               |

---

## Getting Started

**Prerequisites:** Node.js 20+ and pnpm 9+ (developed on pnpm 11.17).

```bash
git clone https://github.com/yagizkoryurek/nexona.git
cd nexona
pnpm install
cp .env.example .env.local
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Environment variables

All three are required. See `.env.example`.

| Variable                        | Scope      | Source                                                 |
| ------------------------------- | ---------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public     | Supabase → Project Settings → API                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public     | Supabase → Project Settings → API                      |
| `GEMINI_API_KEY`                | **Server** | [Google AI Studio](https://aistudio.google.com/apikey) |

The two Supabase values are safe in the browser — the anon key is designed to
be public, and Row Level Security protects the data. `GEMINI_API_KEY` must
never be given a `NEXT_PUBLIC_` prefix.

### Database setup

Run every file in `supabase/migrations/` **in order** in the Supabase SQL
Editor. There is no Supabase CLI project in this repo, so migrations are
applied by hand; each one is written to be safe to re-run.

```
0001_resume_analyses.sql   0004_cover_letters.sql
0002_add_resume_text.sql   0005_career_insights.sql
0003_ats_audits.sql        0006_interview_preps.sql
```

Required Supabase project settings (email confirmations, password length,
redirect URLs) are documented in [CLAUDE.md](CLAUDE.md).

### Scripts

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `pnpm dev`          | Start the development server      |
| `pnpm build`        | Create a production build         |
| `pnpm start`        | Serve the production build        |
| `pnpm lint`         | Run ESLint                        |
| `pnpm typecheck`    | Type-check without emitting files |
| `pnpm format`       | Format all files with Prettier    |
| `pnpm format:check` | Verify formatting without writing |

---

## Project Structure

```
src/
  app/              Routes only — landing, (auth), (legal), (company), dashboard
  components/       Shared UI; ui/ holds shadcn-generated primitives
  lib/
    ai/             One module per AI tool + a shared Gemini client
    supabase/       Browser, server, and middleware clients
  hooks/  types/
supabase/migrations/  SQL, applied manually
```

Each AI tool follows the same shape: a prompt and Zod schema in `lib/ai/`, a
Server Action that re-authenticates and re-validates its input, a route that
loads eligibility server-side, and a client component owning the phase
machine. See [CLAUDE.md](CLAUDE.md) for the full layout and the reasoning
behind it.

---

## Roadmap

Genuinely open work, roughly in priority order.

- [ ] **Automated tests** — there is no test suite of any kind yet.
- [ ] **Rate limiting** on the six AI endpoints; every generation currently
      costs an uncapped API call.
- [ ] **Deploy** to Vercel, and confirm function timeouts on the target plan.
- [ ] **History and detail views** — past analyses, audits, letters, insights,
      and preparation sets are only reachable by re-selecting a résumé.
- [ ] **`.doc` support**, or narrow the file picker to the formats that work.
- [ ] **Align the palette** with the design system.
- [ ] **Replace the placeholder legal copy** with reviewed documents.
- [ ] **Billing**, once the Beta ends and paid plans are defined.

A fuller list of known limitations, with the reasoning behind each, is in
[CLAUDE.md](CLAUDE.md).

---

## Documentation

[**CLAUDE.md**](CLAUDE.md) is the single source of truth for this codebase and
covers:

- **Architecture** — app shell, routing, and component layout
- **AI pipeline** — the shared Gemini layer and all six tool pipelines
- **Database** — every table, its RLS policies, and why each is shaped that way
- **Development rules** — conventions, security requirements, review workflow
- **Known limitations** — what is unfinished or fragile, and why

---

## License

Proprietary. All rights reserved.

This repository is not open-source licensed. No permission is granted to use,
copy, modify, or distribute this software.
