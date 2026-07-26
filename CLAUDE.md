# Nexona — Project Instructions

Permanent rules for working on this codebase. These persist across sessions and sprints.

## Stack

- Next.js 15 (App Router), TypeScript, pnpm
- Tailwind CSS v4
- shadcn/ui components built on **Radix UI** primitives (preset: Nova — Lucide icons + Geist font)
- ESLint 9 (flat config) + Prettier 3 (with `prettier-plugin-tailwindcss`)

## Architecture principles

- Keep the App Router tree (`src/app`) for routes/pages only; shared UI lives in `src/components`.
- shadcn primitives go in `src/components/ui/`; app-specific composed components (Navbar, Hero, etc.) go in `src/components/` (or a subfolder per section) — do not edit generated `ui/` files beyond what shadcn itself writes, extend instead.
- Prefer composition over configuration: small, reusable, single-purpose components over large monolithic sections.
- No business logic, no auth, no data fetching until a sprint explicitly calls for it.
- Don't add dependencies, abstractions, or folders beyond what the current sprint requires.

## Design system

- The Design System PDF is the source of truth for color, type, spacing, radius, and component states. When implementing any UI, match it exactly rather than improvising values.
- The Landing Page PDF is the target visual reference for layout/copy — recreate it as faithfully as possible within the constraints of the design system.
- Do not invent copy, sections, or components not shown in the reference material.

## Development workflow

- Work sprint-by-sprint. Implement **only** what the current sprint's task list specifies — do not build ahead into later sections (e.g. building Hero while only Navbar was requested).
- Do not make architectural decisions unilaterally (new libraries, state management, data layer, folder restructuring, etc.) — explain the tradeoff and ask first.
- Every component must be responsive, accessible (semantic HTML, keyboard navigation, ARIA where needed), and production-quality.
- Before marking a sprint task complete: run `pnpm lint` and `pnpm typecheck`, fix any issues, and only then summarize the changes.
- Stop and wait for review at the end of each sprint task — do not proceed to the next task automatically.

## Package manager

- Always use `pnpm` (not npm/yarn). Use `pnpm dlx shadcn@latest add <component>` to add new shadcn components.
