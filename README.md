# Nexona

AI-powered résumé analysis that tells you why you aren't getting interviews.

Nexona reads a résumé the way a recruiter and an applicant tracking system would, then hands back a specific, prioritised list of what to fix — structure, ATS compatibility, wording, and overall quality — in about forty seconds.

> **Status:** early development. The marketing site is built; the product itself is not. See [Project status](#project-status).

## Key features

The capabilities Nexona is being built to deliver:

- **Resume Analyzer** — a structured read of an existing résumé, uploaded as PDF.
- **ATS Score** — how well the résumé survives automated applicant tracking screening.
- **AI Feedback** — prioritised, specific improvements rather than generic advice.
- **Resume Optimizer** — rewrite suggestions applied to the résumé itself.
- **Cover Letter Generator** — a matching cover letter drawn from the résumé.
- **PDF Export** — the improved résumé, ready to send.

Nexona is aimed at students, graduates, professionals, career changers, and anyone trying to improve their job applications.

## Project status

**Sprint 2A — Landing Page: complete.**

The public landing page is fully implemented and responsive:

| Section      | Status |
| ------------ | ------ |
| Navbar       | Done   |
| Hero         | Done   |
| Features     | Done   |
| How It Works | Done   |
| Pricing      | Done   |
| FAQ          | Done   |
| Footer       | Done   |

No authentication, data layer, or résumé-processing functionality exists yet. Every feature listed above is planned, not shipped.

**Next milestone: Sprint 2B — Authentication.**

## Tech stack

- **Framework** — [Next.js 15](https://nextjs.org) (App Router), React 19
- **Language** — TypeScript
- **Styling** — Tailwind CSS v4
- **Components** — [shadcn/ui](https://ui.shadcn.com) on Radix UI primitives, Lucide icons
- **Tooling** — ESLint 9 (flat config), Prettier 3
- **Package manager** — pnpm

## Getting started

**Prerequisites:** Node.js 20+ and pnpm 9+.

```bash
git clone https://github.com/yagizkoryurek/nexona.git
cd nexona
pnpm install
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

No environment variables are required — the landing page is fully static and has no external service dependencies.

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
- [ ] Authentication
- [ ] Résumé upload (PDF)
- [ ] Résumé analysis and ATS scoring
- [ ] AI feedback
- [ ] User dashboard

### Beyond MVP

- [ ] Resume Optimizer
- [ ] Cover Letter Generator
- [ ] PDF export
- [ ] Subscription billing (Free and Pro plans)
- [ ] Additional upload formats beyond PDF

## License

Proprietary. All rights reserved.

This repository is not open-source licensed. No permission is granted to use, copy, modify, or distribute this software.
