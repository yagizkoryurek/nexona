# Changelog

All notable changes to Nexona are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versioning follows [Semantic Versioning](https://semver.org/). The project
is pre-1.0 and in Beta: the public interface, database schema, and feature set
may still change without a major version bump.

## [0.1.0-beta.1] - 2026-08-15

First public Beta release.

### Added

**Authentication** — Supabase email/password sign-up with required email
confirmation, sign in, sign out, forgot password, reset password, and an
`/auth/callback` route handling both confirmation and recovery links. Session
refresh and route protection run through `src/middleware.ts` on every
protected and auth-only route. Sign-in errors are identical for an unknown
address and a wrong password, so the flow cannot be used to enumerate
accounts. Transactional auth email is sent through a custom SMTP provider
(Brevo).

**Dashboard shell** — a guarded sidebar layout at `/dashboard` with persistent
navigation, collapse state that survives reload, and a mobile drawer.

**Six AI-backed tools**, each built on one shared Gemini client and a common
pipeline (authenticate, validate, generate, validate the response, persist):

- **Resume Analyzer** — upload a PDF or DOCX résumé; returns an overall
  score, an ATS score, a one-sentence summary, and specific strengths,
  weaknesses, and suggestions.
- **Resume Optimizer** — rewrites a previously analyzed résumé for wording
  and structure, preserving every factual detail exactly as given.
- **ATS Compatibility Check** — a qualitative audit of formatting, section
  structure, keywords, and readability, plus present/missing keywords,
  parsing blockers ranked by severity, and prioritized recommendations. Never
  produces its own score — it explains the résumé's existing ATS score
  rather than computing a second, potentially conflicting one.
- **Cover Letter Generator** — writes a cover letter grounded entirely in a
  résumé's own stored content and analysis, given a job title, optional
  company name, and job description.
- **Career Insights** — assesses professional positioning: recurring
  strength themes with evidence, roles the résumé already supports, skill
  gaps, and prioritized next steps.
- **Interview Preparation** — the interview a résumé implies: an overview of
  how the candidate is likely to come across, 6–12 likely questions each
  grounded in specific résumé content, talking points, and rehearsal
  priorities.

Every tool re-authenticates and re-validates its input server-side; nothing
trusts client-side selection as a security boundary. Three tools (ATS Check,
Career Insights, Interview Preparation) cache their result and serve it again
on re-open at no cost; regenerating is always available on demand.

**AI usage protection** — a centralized, database-backed rate limiter applies
to all six AI tools: 15 generations per 10 minutes, 50 per hour, and 100 per
day, per user, with a maximum of 2 concurrent generations. Limits are
enforced atomically in Postgres so they hold under concurrent serverless
requests, not just within a single request. A cached result never counts
against the limit; a regeneration always does. Rejection messages are
specific and human-readable (a usage-limit message, a distinct
concurrent-generation message, or a generic service-unavailable message for
an actual AI provider failure) and never expose internal details like
provider error codes.

**Legal and company pages** — public `/terms` and `/privacy` pages (clearly
marked as placeholder content pending legal review), and `/about` and
`/contact` pages describing the project and its GitHub-based support channel.

**Reliability and error handling** — a custom `not-found` page, a
route-level `error` boundary with a "Try again" action, a root
`global-error` boundary as the last line of defense, a dashboard-scoped
error boundary matching the app shell, and a dashboard loading skeleton.

**Environment variable validation** — required configuration
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`GEMINI_API_KEY`) is validated centrally with a clear startup error naming
the missing variable, instead of failing later with an unrelated error deep
in a request.

**Toolchain pinning** — Node.js and pnpm versions are pinned
(`.nvmrc`, `engines.node`, `packageManager`) so local, CI, and production
environments run the same runtime.

### Known limitations

Nexona is a working Beta, not a finished product. There is no automated test
suite yet, no history/detail view for past analyses and generated documents,
`.doc` files are not supported (only `.pdf` and `.docx`), and there is no
billing or paid tier — every tool is free during the Beta. The full, current
list of known limitations and the reasoning behind each is maintained in
[CLAUDE.md](CLAUDE.md).
