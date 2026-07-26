# Nexona — Project Context

## Overview

Nexona is a new SaaS project. Sprint 1 established a clean Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui foundation. Sprint 2 is building the marketing landing page section-by-section, following a Design System PDF (source of truth for visual tokens) and a Landing Page PDF (target layout/copy reference).

## Completed work

**Sprint 1 — Project Foundation** (committed: `65050e7`)
- Next.js 15.5.21 app scaffolded with App Router, TypeScript, `src/` layout, `@/*` import alias.
- Tailwind CSS v4 configured.
- shadcn/ui initialized (Radix UI primitives, Nova preset — Lucide icons + Geist font).
- ESLint 9 (flat config) + Prettier 3 configured, with `eslint-config-prettier` and `prettier-plugin-tailwindcss` wired in.
- Scripts added: `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`.
- Homepage is minimal placeholder text ("Nexona"). No auth, no business logic, no excluded libraries (Supabase/OpenAI/Stripe/Prisma/RHF/Zod/Framer Motion) present.

## Current sprint

**Sprint 2A — Landing Page: Navbar + Hero**

Scope was later narrowed mid-sprint to **2A.1 — Navbar only**, to be reviewed before Hero is built.

## Current task

Implement the responsive Navbar (2A.1):
- Desktop: Nexona logo, Features, Pricing, FAQ, Sign In, Get Started.
- Mobile: hamburger menu with smooth open/close animation, accessible keyboard navigation.
- Sticky on scroll, with the scroll-state visual treatment (border/background/shadow) specified in the Design System.
- Reusable components, semantic HTML, accessibility best practices.
- Explicitly excluded from this task: Hero, Features, Product Preview, Pricing, FAQ, Footer.

**Status: not yet implemented.** No Navbar or Hero code exists in `src/` yet — both the original Sprint 2A request and the narrower 2A.1 request were interrupted before implementation began. This is the next work to pick up.

## Next task

Once the Navbar is implemented and reviewed:
- Build the Hero section (headline, supporting text, primary CTA, secondary CTA, product preview) per the original Sprint 2A scope, as its own reviewed step.
- Stop after Hero — no further landing page sections (Features, Pricing, FAQ, Footer, etc.) until a future sprint explicitly requests them.

## Important decisions

- shadcn/ui uses **Radix UI** primitives (not Base UI or React Aria) — chosen for ecosystem maturity and community material, per explicit user choice in Sprint 1.
- shadcn preset **Nova** (Lucide icons + Geist font) — matches the font already set up by `create-next-app`.
- Node.js and pnpm were not present on the dev machine at project start; installed via Homebrew (Node 26.5.0, pnpm 11.17.0) with user approval.
- `pnpm-workspace.yaml` explicitly allows build scripts for `sharp` and `unrs-resolver` (required under pnpm 11's stricter default of blocking postinstall scripts).
- Sprints are being executed in narrow, reviewable slices (e.g. splitting "Navbar + Hero" into Navbar-only first) rather than delivering multiple sections at once.

## Pending work

- Navbar implementation (current task, not started).
- Hero implementation (next task, blocked on Navbar review).
- Everything beyond Hero (Features, Product Preview, Pricing, FAQ, Footer, auth, business logic) is out of scope until explicitly requested in a future sprint.
