-- Nexona — Career Insights
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: every statement is guarded.
--
-- Written for Career Insights
-- (src/components/dashboard/career-insights-action.ts), which reads a resume
-- that has already been analyzed and describes the candidate's professional
-- position: how the profile reads, which roles it supports, which skills are
-- missing, and what to do next. The other four tools judge or rewrite the
-- document; this one is about the person the document describes.
--
-- Same table-not-column reasoning as ats_audits (0003) and cover_letters
-- (0004): writing insights onto resume_analyses would need an UPDATE policy
-- there, and RLS policies are per-row, not per-column — granting UPDATE for
-- one field would let a client rewrite overall_score, ats_score, summary and
-- resume_text too. That row stays insert-and-read-only.
--
-- Not folded into ats_audits with a `kind` discriminator either, even though
-- the column shape here is identical (one jsonb document plus a version) and
-- the cover_letters argument for a separate table therefore does not apply.
-- The reason is versioning, not shape: schema_version describes exactly one
-- Zod schema, and the audit and insight documents evolve independently. In a
-- shared table `schema_version = 2` would be ambiguous about which document
-- it versions, and every reader would carry a `kind` predicate to answer a
-- question the table name already answers.

create table if not exists public.career_insights (
  id uuid primary key default gen_random_uuid(),

  -- Cascade: insights are meaningless without the analysis they were derived
  -- from.
  analysis_id uuid not null
    references public.resume_analyses (id) on delete cascade,

  -- Denormalized from the parent, same reasoning as ats_audits.user_id and
  -- cover_letters.user_id: turns the SELECT policy into a cheap index-backed
  -- equality test instead of a per-row subquery. The INSERT policy's exists()
  -- clause is what keeps it honest.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The whole validated insights document, exactly as careerInsightsSchema
  -- defines it (src/lib/ai/career-insights.ts). One jsonb value rather than
  -- shredded into columns, same reasoning as ats_audits.audit: every client —
  -- web today, mobile later — reads a single document and validates it with
  -- the same schema, instead of reassembling a shape the database imposed.
  --
  -- Deliberately NO numeric column of any kind, and no copy of overall_score
  -- or ats_score. Those live on resume_analyses and are the single source of
  -- truth. The model is shown them as read-only context for its reasoning,
  -- but it is instructed never to reinterpret, explain, or derive a new score
  -- from them, and the Zod schema has no numeric field for one to land in —
  -- so nothing scorelike can reach this column. Storing a number here would
  -- recreate exactly the two-competing-scores problem the ATS Check was
  -- designed to avoid.
  insights jsonb not null,

  -- Which shape `insights` is in. The schema will evolve while already-shipped
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
-- Note this matches ats_audits rather than cover_letters. Insights for a
-- resume converge on one answer, so the newest supersedes the older — there
-- is no second axis (the way a letter is keyed to a job) that would make two
-- concurrent sets of insights legitimately different and both worth keeping.
create index if not exists career_insights_analysis_id_created_at_idx
  on public.career_insights (analysis_id, created_at desc);

-- Supports the RLS predicate below and the "which of my analyses already have
-- insights" lookup the picker needs for its annotation.
create index if not exists career_insights_user_id_created_at_idx
  on public.career_insights (user_id, created_at desc);

alter table public.career_insights enable row level security;

-- Scoped to `authenticated`, same reasoning as 0001, 0003 and 0004: an
-- anonymous request has no auth.uid() and matches nothing regardless, but
-- naming the role makes the intent explicit.
--
-- The exists() clause is not redundant with the user_id check, same reasoning
-- as ats_audits and cover_letters: the foreign key proves the analysis
-- exists, not that the caller owns it. Without this clause a caller could
-- attach insights carrying their own user_id to someone else's analysis_id.
-- They still could not read the parent row, but they could write rows against
-- another account's data.
drop policy if exists "Users can insert insights for their own analyses" on public.career_insights;
create policy "Users can insert insights for their own analyses"
  on public.career_insights
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

drop policy if exists "Users can read their own insights" on public.career_insights;
create policy "Users can read their own insights"
  on public.career_insights
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy, same as 0001, 0003 and 0004: an insights
-- document is a point-in-time record. With RLS enabled, the absence of a
-- policy is itself the denial.
