# Nexona

AI-powered résumé analysis that tells you why you aren't getting interviews.

Nexona reads a résumé the way a recruiter and an applicant tracking system would, then hands back a specific, prioritised list of what to fix — structure, ATS compatibility, wording, and overall quality — in about forty seconds.

> **Status:** in development. The landing page, authentication, and the Resume Analyzer are working. See [Project status](#project-status).

## Key features

**Available now**

- **Resume Analyzer** — a structured read of an existing résumé (PDF or DOCX), returning an overall quality score, an ATS compatibility score, a summary, and specific strengths, weaknesses, and improvement suggestions.
- **Accounts** — email/password sign-up with confirmation, sign-in, and password reset.

**Planned**

- **Dashboard** — a proper app shell with sidebar navigation across tools.
- **Resume Optimizer** — rewrite suggestions applied to the résumé itself.
- **ATS Checker** — a deeper, dedicated compatibility pass.
- **Cover Letter Generator** — a matching cover letter drawn from the résumé.
- **Career Insights** — guidance drawn from analysis history.

Nexona is aimed at students, graduates, professionals, career changers, and anyone trying to improve their job applications.

## Project status

| Area                     | Status  |
| ------------------------ | ------- |
| Landing page             | Done    |
| Authentication           | Done    |
| Résumé upload (PDF/DOCX) | Done    |
| AI analysis + scoring    | Done    |
| Analysis persistence     | Done    |
| Dashboard + navigation   | Planned |
| Optimizer / Cover Letter | Planned |

Engineering detail — architecture, conventions, and known limitations — lives in [CLAUDE.md](CLAUDE.md).

## Tech stack

- **Framework** — [Next.js 15](https://nextjs.org) (App Router), React 19
- **Language** — TypeScript
- **Styling** — Tailwind CSS v4
- **Components** — [shadcn/ui](https://ui.shadcn.com) on Radix UI primitives, Lucide icons
- **Auth & database** — [Supabase](https://supabase.com) (`@supabase/ssr`)
- **AI** — [Google Gemini](https://ai.google.dev) (`@google/genai`)
- **Document parsing** — `unpdf` (PDF), `mammoth` (DOCX)
- **Forms** — react-hook-form + Zod
- **Tooling** — ESLint 9 (flat config), Prettier 3
- **Package manager** — pnpm

## Getting started

**Prerequisites:** Node.js 20+ and pnpm 9+.

```bash
git clone https://github.com/yagizkoryurek/nexona.git
cd nexona
pnpm install
cp .env.example .env.local   # then fill in the three values
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

**Environment variables** are required — see `.env.example`. You will need a
Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
and a Google AI Studio key (`GEMINI_API_KEY`).

**Database setup:** run `supabase/migrations/0001_resume_analyses.sql` once in
the Supabase SQL Editor. See [CLAUDE.md](CLAUDE.md) for the required Supabase
project settings.

## Available scripts

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `pnpm dev`          | Start the development server      |
| `pnpm build`        | Create a production build         |
| `pnpm start`        | Serve the production build        |
| `pnpm lint`         | Run ESLint                        |
| `pnpm typecheck`    | Type-check without emitting files |
| `pnpm format`       | Format all files with Prettier    |
| `pnpm format:check` | Verify formatting without writing |

To add a shadcn/ui component:

```bash
pnpm dlx shadcn@latest add <component>
```

## Roadmap

### MVP

- [x] Landing page
- [x] Authentication
- [x] Résumé upload (PDF, DOCX)
- [x] Résumé analysis and ATS scoring
- [x] AI feedback
- [ ] User dashboard with sidebar navigation

### Beyond MVP

- [ ] Resume Optimizer
- [ ] ATS Checker
- [ ] Cover Letter Generator
- [ ] Career Insights

## License

Proprietary. All rights reserved.

This repository is not open-source licensed. No permission is granted to use, copy, modify, or distribute this software.
