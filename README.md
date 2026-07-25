# Nexona

## Stack

- Next.js 15.5.21 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (Radix primitives)
- ESLint + Prettier
- pnpm

## Getting started

```bash
pnpm install
pnpm dev
```

## Scripts

| Script              | Description                     |
| ------------------- | ------------------------------- |
| `pnpm dev`          | Start the dev server            |
| `pnpm build`        | Production build                |
| `pnpm start`        | Serve the production build      |
| `pnpm lint`         | Run ESLint                      |
| `pnpm typecheck`    | Type-check without emitting     |
| `pnpm format`       | Format all files with Prettier  |
| `pnpm format:check` | Check formatting without fixing |

## Adding shadcn/ui components

```bash
pnpm dlx shadcn@latest add <component>
```
