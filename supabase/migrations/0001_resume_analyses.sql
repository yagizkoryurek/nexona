-- Nexona — initial schema
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: every statement is guarded.
--
-- Scope: one table. The application's only database write is the insert in
-- src/components/dashboard/resume-analyze-action.ts. Authentication uses
-- Supabase's own `auth.users` (including `raw_user_meta_data.full_name`,
-- populated at sign-up), which Supabase manages — no table of ours mirrors it.
-- No Storage bucket is defined because the uploaded resume is never persisted:
-- its text is extracted in memory during the request and discarded.

create table if not exists public.resume_analyses (
  id uuid primary key default gen_random_uuid(),

  -- Cascade so deleting an account removes its analyses with it, rather than
  -- orphaning rows that RLS would then make unreachable but still billable.
  user_id uuid not null references auth.users (id) on delete cascade,

  file_name text not null,

  -- Scores are 0-100 by contract with the AI layer's Zod schema
  -- (resumeAnalysisSchema in src/lib/ai/resume-analysis.ts). Enforced here too
  -- so a bad value can never land in the table even if that check is bypassed.
  overall_score smallint not null check (overall_score between 0 and 100),
  ats_score smallint not null check (ats_score between 0 and 100),

  summary text not null,

  -- Arrays of strings. jsonb (not text[]) because the application inserts the
  -- parsed JSON arrays straight through and reads them back the same way.
  strengths jsonb not null,
  weaknesses jsonb not null,
  suggestions jsonb not null,

  created_at timestamptz not null default now()
);

-- Supports both the RLS predicate below (which filters every row by user_id)
-- and the natural "my analyses, newest first" read. Without it, each query
-- degrades to a sequential scan once the table grows.
create index if not exists resume_analyses_user_id_created_at_idx
  on public.resume_analyses (user_id, created_at desc);

alter table public.resume_analyses enable row level security;

-- Policies are scoped to `authenticated`: an anonymous request has no
-- auth.uid(), so it matches nothing regardless, but naming the role makes the
-- intent explicit and keeps the anon key from being probed against this table.
drop policy if exists "Users can insert their own analyses" on public.resume_analyses;
create policy "Users can insert their own analyses"
  on public.resume_analyses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own analyses" on public.resume_analyses;
create policy "Users can read their own analyses"
  on public.resume_analyses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy, and no updated_at column or trigger: an analysis
-- is a point-in-time record that the application only ever inserts and reads.
-- With RLS enabled, the absence of a policy is itself the denial — nothing can
-- modify or remove a row through the API.
