-- Nexona — add resume_text to resume_analyses
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: the column addition is guarded.
--
-- Nullable and forward-only: existing rows keep null here. The Resume
-- Optimizer (src/components/dashboard/resume-optimize-action.ts) needs the
-- real resume text to generate a rewrite, not just the AI-derived scores and
-- feedback already stored — so analysis time now also persists the extracted
-- text (src/components/dashboard/resume-analyze-action.ts). This is a
-- deliberate reversal of this table's original design, which discarded the
-- resume's text after analysis; see CLAUDE.md's Persistence section. Rows
-- created before this migration have no resume_text and are excluded from the
-- Optimizer's picker rather than treated as an error.

alter table public.resume_analyses
  add column if not exists resume_text text;
