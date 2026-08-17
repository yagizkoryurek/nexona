-- Nexona — bound resume_text length (security finding A1)
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: the constraint is added only when absent.
--
-- WHY THIS EXISTS
--
-- The AI rate limiter (migration 0007) caps how *many* generations a user may
-- run, never how *large* each one is. Application-side, MAX_EXTRACTED_CHARACTERS
-- in src/lib/resume-text-extraction.ts now rejects an over-long extraction
-- before it reaches Gemini. That check alone is not sufficient, because it only
-- covers text arriving through the upload pipeline.
--
-- `resume_analyses` has an INSERT policy granted to `authenticated`
-- (migration 0001), so any signed-in client can POST a row straight to
-- PostgREST with the public anon key and an arbitrary `resume_text` — no file,
-- no extraction, no application code involved. It would then be selectable by
-- the Optimizer, ATS Check, Cover Letter, Career Insights and Interview Prep
-- pickers and sent to Gemini in full. This constraint is what actually closes
-- that path: it is enforced by Postgres regardless of which client wrote the
-- row or whether the application check ran.
--
-- The 50,000 figure MUST stay equal to MAX_EXTRACTED_CHARACTERS in
-- src/lib/resume-text-extraction.ts. A test in that module's .test.ts file
-- parses this file and asserts the two match, so drift fails CI rather than
-- silently letting one side diverge from the other.
--
-- SAFETY FOR EXISTING ROWS
--
-- `not valid` is used deliberately. It applies the constraint to all future
-- inserts and updates while skipping the initial full-table scan, so the
-- migration cannot fail on (or lock) pre-existing data. Every row in production
-- today is far under the limit — the longest is roughly 2,600 characters — so
-- this is about avoiding an unnecessary table scan and an all-or-nothing
-- migration, not about tolerating known-bad rows. The constraint can be
-- promoted later with:
--     alter table public.resume_analyses
--       validate constraint resume_analyses_resume_text_length_check;
--
-- Nulls pass a CHECK constraint, so the nullable, forward-only design from
-- migration 0002 is preserved: analyses created before resume_text existed keep
-- their null and remain untouched.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.resume_analyses'::regclass
      and conname = 'resume_analyses_resume_text_length_check'
  ) then
    alter table public.resume_analyses
      add constraint resume_analyses_resume_text_length_check
      check (char_length(resume_text) <= 50000)
      not valid;
  end if;
end
$$;
