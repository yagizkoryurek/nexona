-- Nexona — Interview Preparation
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: every statement is guarded.
--
-- Written for AI Interview Preparation
-- (src/components/dashboard/interview-prep-action.ts), which reads a resume
-- that has already been analyzed and produces the interview it implies:
-- likely questions with the resume content that prompts each, guidance for
-- answering from the candidate's own material, talking points worth having
-- ready, and priority-ranked preparation areas.
--
-- Same table-not-column reasoning as ats_audits (0003), cover_letters (0004)
-- and career_insights (0005): writing this onto resume_analyses would need an
-- UPDATE policy there, and RLS policies are per-row, not per-column — granting
-- UPDATE for one field would let a client rewrite overall_score, ats_score,
-- summary and resume_text too. That row stays insert-and-read-only.
--
-- THE DERIVED-DOCUMENT TABLE SHAPE. This is the third table with an identical
-- column shape (analysis_id, user_id, one jsonb document, schema_version,
-- created_at) — ats_audits, career_insights, and now interview_preps. That is
-- a deliberate convention, not duplication that wants collapsing into one
-- table with a `kind` discriminator. The reason is versioning: schema_version
-- describes exactly one Zod schema, and these documents evolve independently.
-- In a shared table `schema_version = 2` would be ambiguous about which
-- document it versions, and the ambiguity gets worse with each kind added,
-- not better — three independent version lineages in one column would be
-- harder to reason about than three tables, not easier. A fourth derived
-- document should copy this file rather than merge into it.
--
-- (Note this is a different argument from the one that keeps cover_letters
-- separate. That table is separate because a letter's two real inputs and one
-- output are naturally their own columns; a shared table would leave half its
-- columns null. Here the shape genuinely is identical, so versioning is the
-- whole reason.)

create table if not exists public.interview_preps (
  id uuid primary key default gen_random_uuid(),

  -- Cascade: preparation is meaningless without the resume it was built from.
  analysis_id uuid not null
    references public.resume_analyses (id) on delete cascade,

  -- Denormalized from the parent, same reasoning as the sibling tables: turns
  -- the SELECT policy into a cheap index-backed equality test instead of a
  -- per-row subquery. The INSERT policy's exists() clause keeps it honest.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The whole validated preparation document, exactly as interviewPrepSchema
  -- defines it (src/lib/ai/interview-prep.ts). One jsonb value rather than
  -- shredded into columns — every client, web today and mobile later, reads a
  -- single document and validates it with the same schema instead of
  -- reassembling a shape the database imposed. The questions array in
  -- particular is variable-length and nested; shredding it would mean a child
  -- table and a join for no gain.
  --
  -- Deliberately NO numeric column of any kind, and no copy of overall_score
  -- or ats_score. Those live on resume_analyses and are the single source of
  -- truth. Unlike career_insights — which is shown both scores as fenced
  -- read-only context — this tool is not shown them at all: they measure
  -- document quality, which says nothing about what a hiring manager would
  -- ask, and an interviewer has no access to them either. interviewPrepSchema
  -- has no numeric field for a score to land in, so nothing scorelike can
  -- reach this column.
  prep jsonb not null,

  -- Which shape `prep` is in. The schema will evolve while already-shipped
  -- clients keep reading rows written by older versions; readers validate with
  -- Zod and fall back to regenerating rather than trusting stored jsonb just
  -- because it was valid when written.
  schema_version smallint not null default 1,

  created_at timestamptz not null default now()
);

-- Regenerating appends a new row; readers take the newest for an analysis.
-- Deliberately no unique constraint on analysis_id: enforcing one row per
-- analysis would make regeneration an UPDATE, reintroducing the very policy
-- problem this table exists to avoid. Append-only is both safer and a free
-- history.
--
-- This follows ats_audits and career_insights, not cover_letters. The likely
-- interview questions for a fixed resume converge on one answer — there is no
-- second axis (the way a letter is keyed to a job) making two concurrent sets
-- legitimately different and both worth keeping at once. "Generate again"
-- exists to give the candidate fresh practice material on demand, and the
-- newest row supersedes the older one.
create index if not exists interview_preps_analysis_id_created_at_idx
  on public.interview_preps (analysis_id, created_at desc);

-- Supports the RLS predicate below and the "which of my analyses already have
-- preparation" lookup the picker needs for its annotation.
create index if not exists interview_preps_user_id_created_at_idx
  on public.interview_preps (user_id, created_at desc);

alter table public.interview_preps enable row level security;

-- Scoped to `authenticated`, same reasoning as 0001, 0003, 0004 and 0005: an
-- anonymous request has no auth.uid() and matches nothing regardless, but
-- naming the role makes the intent explicit.
--
-- The exists() clause is not redundant with the user_id check, same reasoning
-- as the sibling tables: the foreign key proves the analysis exists, not that
-- the caller owns it. Without this clause a caller could attach preparation
-- carrying their own user_id to someone else's analysis_id. They still could
-- not read the parent row, but they could write rows against another
-- account's data.
drop policy if exists "Users can insert interview prep for their own analyses" on public.interview_preps;
create policy "Users can insert interview prep for their own analyses"
  on public.interview_preps
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

drop policy if exists "Users can read their own interview prep" on public.interview_preps;
create policy "Users can read their own interview prep"
  on public.interview_preps
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy, same as 0001, 0003, 0004 and 0005: a preparation
-- document is a point-in-time record. With RLS enabled, the absence of a
-- policy is itself the denial.
