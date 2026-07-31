-- Nexona — Cover Letter Generator
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: every statement is guarded.
--
-- Written for the Cover Letter Generator
-- (src/components/dashboard/cover-letter-action.ts), which generates a cover
-- letter grounded in a resume's stored analysis, addressed to a specific job.
--
-- Same table-not-column reasoning as ats_audits (migration 0003): writing a
-- letter onto resume_analyses would need an UPDATE policy there, and RLS
-- policies are per-row, not per-column — granting UPDATE for one field would
-- let a client rewrite overall_score, summary, resume_text too. That row
-- stays insert-and-read-only.
--
-- Not folded into ats_audits with a `kind` discriminator either, despite the
-- identical RLS shape: an audit is one jsonb document every client reads the
-- same way, but a letter has two real inputs (job_title, job_description)
-- and one output (letter) that are naturally their own columns — a shared
-- table would leave half its columns null depending on kind.

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),

  -- Cascade: a letter is meaningless without the analysis it was written from.
  analysis_id uuid not null
    references public.resume_analyses (id) on delete cascade,

  -- Denormalized from the parent, same reasoning as ats_audits.user_id: turns
  -- the SELECT policy into a cheap index-backed equality test. The INSERT
  -- policy's exists() clause is what keeps it honest.
  user_id uuid not null references auth.users (id) on delete cascade,

  job_title text not null,

  -- Nullable: the prompt is instructed to address the letter generically
  -- when no company name is given, rather than invent one or emit a
  -- placeholder token — see lib/ai/cover-letter.ts.
  company_name text,

  -- Stored permanently, not treated as transient input: without it, a stored
  -- letter has no reconstructable record of what job it was written for
  -- beyond job_title/company_name, and "Generate another" for the same job
  -- has nothing to prefill from. Job postings are public listings the user
  -- pasted in, not personal data, so this carries none of the sensitivity
  -- that would argue for discarding it. Bounded to 10,000 characters by the
  -- application layer (coverLetterInputSchema in lib/ai/cover-letter.ts) —
  -- not enforced again here, matching how resume_text and the analysis jsonb
  -- columns rely on application-layer validation rather than a check
  -- constraint.
  job_description text not null,

  -- The generated letter. Plain text, not jsonb: the deliverable is one
  -- document, not structured data any client needs to branch on — same
  -- shape as resume_analyses.resume_text.
  letter text not null,

  -- Which shape this row's non-jsonb columns are in, for consistency with
  -- ats_audits even though there is no jsonb blob here to re-validate on
  -- read. Kept for the same forward-compatibility reason: a future column
  -- addition can be told apart from an older row without inferring it from
  -- nullability.
  schema_version smallint not null default 1,

  created_at timestamptz not null default now()
);

-- Deliberately no unique constraint on analysis_id, and no versioning scheme
-- beyond "every generation is a new row, newest first." A cover letter is
-- keyed to a job, not just a resume: the same analysis can legitimately
-- produce many different letters for many different jobs, all worth keeping
-- at once. Unlike ats_audits, where the newest audit supersedes the old one,
-- here there is no single "the" letter for an analysis to converge on — a
-- constraint that let a second job's letter overwrite a first would delete
-- a still-wanted document, not merely an outdated one.
create index if not exists cover_letters_analysis_id_created_at_idx
  on public.cover_letters (analysis_id, created_at desc);

create index if not exists cover_letters_user_id_created_at_idx
  on public.cover_letters (user_id, created_at desc);

alter table public.cover_letters enable row level security;

-- Scoped to `authenticated`, same reasoning as 0001 and 0003: an anonymous
-- request has no auth.uid() and matches nothing regardless, but naming the
-- role makes the intent explicit.
--
-- The exists() clause is not redundant with the user_id check, same
-- reasoning as ats_audits: the foreign key proves the analysis exists, not
-- that the caller owns it. Without this clause a caller could attach a
-- letter carrying their own user_id to someone else's analysis_id.
drop policy if exists "Users can insert cover letters for their own analyses" on public.cover_letters;
create policy "Users can insert cover letters for their own analyses"
  on public.cover_letters
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.resume_analyses ra
      where ra.id = analysis_id
        and ra.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can read their own cover letters" on public.cover_letters;
create policy "Users can read their own cover letters"
  on public.cover_letters
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy, same as 0001 and 0003: a letter is a
-- point-in-time record. With RLS enabled, the absence of a policy is itself
-- the denial.
