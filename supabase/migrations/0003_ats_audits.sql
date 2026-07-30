-- Nexona — ATS audit results
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: every statement is guarded.
--
-- Written for the ATS Compatibility Check
-- (src/components/dashboard/ats-audit-action.ts), which produces a detailed,
-- qualitative ATS audit of a resume that has already been analyzed.
--
-- Why a new table rather than an `ats_audit jsonb` column on
-- resume_analyses: writing an audit onto an existing analysis row would need
-- an UPDATE policy on that table, and RLS policies are per-row, not
-- per-column — granting UPDATE so the app could write one column would also
-- let any client rewrite overall_score, ats_score, summary, strengths, and
-- resume_text on their own rows. Restricting that needs column-level GRANTs, a
-- separate mechanism. It would also break the invariant 0001 documents: an
-- analysis is a point-in-time record that is only ever inserted and read.
-- Since the ATS score stored there is now the single source of truth for ATS
-- compatibility, that row should be harder to mutate, not easier.

create table if not exists public.ats_audits (
  id uuid primary key default gen_random_uuid(),

  -- Cascade: an audit is meaningless without the analysis it audits.
  analysis_id uuid not null
    references public.resume_analyses (id) on delete cascade,

  -- Denormalized from the parent analysis so the SELECT policy below is a
  -- cheap, index-backed equality test instead of a per-row subquery. The
  -- INSERT policy is what keeps it honest — see the exists() clause.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The whole validated audit document, exactly as atsAuditSchema defines it
  -- (src/lib/ai/ats-audit.ts). Stored as one jsonb value rather than shredded
  -- into columns so every client — web today, mobile later — reads a single
  -- document and validates it with the same schema, instead of reassembling a
  -- shape the database happens to impose.
  --
  -- Deliberately NO ats_score column here. That number lives on
  -- resume_analyses and is the single source of truth; the audit explains it
  -- rather than recomputing it, so duplicating it here would create exactly
  -- the two-conflicting-scores problem this design avoids.
  audit jsonb not null,

  -- Which shape `audit` is in. The audit schema will evolve while
  -- already-shipped clients keep reading rows written by older versions;
  -- readers validate with Zod and fall back to re-running rather than
  -- trusting stored jsonb just because it was valid when written.
  schema_version smallint not null default 1,

  created_at timestamptz not null default now()
);

-- Re-auditing appends a new row; readers take the newest for an analysis.
-- There is deliberately no unique constraint on analysis_id: enforcing one
-- audit per analysis would make re-audit an UPDATE, reintroducing the very
-- policy problem this table exists to avoid. Append-only is both safer and a
-- free audit trail.
create index if not exists ats_audits_analysis_id_created_at_idx
  on public.ats_audits (analysis_id, created_at desc);

-- Supports the RLS predicate below and the "which of my analyses have been
-- audited" lookup the picker needs.
create index if not exists ats_audits_user_id_created_at_idx
  on public.ats_audits (user_id, created_at desc);

alter table public.ats_audits enable row level security;

-- Scoped to `authenticated`, same reasoning as 0001: an anonymous request has
-- no auth.uid() and matches nothing regardless, but naming the role makes the
-- intent explicit.
--
-- The exists() clause is not redundant with the user_id check. Without it, a
-- caller could insert a row carrying their own user_id while pointing
-- analysis_id at someone else's analysis — the foreign key verifies that the
-- analysis exists, not that the caller owns it. They still could not read the
-- parent row, but they could attach rows to another account's data. Requiring
-- both conditions means an audit can only ever be created for an analysis the
-- caller actually owns.
drop policy if exists "Users can insert audits for their own analyses" on public.ats_audits;
create policy "Users can insert audits for their own analyses"
  on public.ats_audits
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

drop policy if exists "Users can read their own audits" on public.ats_audits;
create policy "Users can read their own audits"
  on public.ats_audits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No UPDATE or DELETE policy, same as 0001: an audit is a point-in-time
-- record. With RLS enabled, the absence of a policy is itself the denial.
