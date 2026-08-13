-- Nexona — AI usage events (Sprint 10.4 rate limiting)
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: every statement is guarded.
--
-- One append-only log of every Gemini generation *attempt* across all six AI
-- tools (src/components/dashboard/*-action.ts), used both for time-windowed
-- rate limits (15/10min, 50/hour, 100/day) and for a concurrency cap (max 2
-- in-flight per user). A 'started' row is written only after every limit
-- check passes; a later 'succeeded' or 'failed' row (linked via
-- reservation_id) closes it out and frees the concurrency slot. Matches this
-- project's existing insert-only convention — no UPDATE is ever performed on
-- this table, despite the concurrency requirement, because atomicity comes
-- from an advisory lock inside reserve_ai_usage(), not from row mutation.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users (id) on delete cascade,

  -- Matches the dashboard route segment exactly (src/app/dashboard/<tool>),
  -- so a row is traceable back to its page without a lookup table.
  tool text not null check (
    tool in (
      'resume-analyzer', 'resume-optimizer', 'ats-checker',
      'cover-letter', 'career-insights', 'interview-prep'
    )
  ),

  -- 'started' = a reservation was granted and a Gemini call is about to be
  -- made. 'succeeded'/'failed' close out a 'started' row via reservation_id.
  -- Only 'started' rows count toward the three time windows — a call that
  -- was reserved but never resolved (a crashed/timed-out function) still
  -- counts against the user's quota for the window, same as any other
  -- attempt that used up an API round trip.
  event_type text not null check (event_type in ('started', 'succeeded', 'failed')),

  -- Set only on 'succeeded'/'failed' rows, pointing back at the 'started' row
  -- it resolves. Null on 'started' rows.
  reservation_id uuid references public.ai_usage_events (id),

  created_at timestamptz not null default now()
);

-- Powers all three window checks (10 minutes / hour / day) and the in-flight
-- lookup — every query this table serves filters on user_id and orders/
-- bounds by created_at.
create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

-- Speeds the reservation_id lookup inside the in-flight NOT EXISTS check.
create index if not exists ai_usage_events_reservation_idx
  on public.ai_usage_events (reservation_id)
  where reservation_id is not null;

alter table public.ai_usage_events enable row level security;

-- Fully closed to clients: no SELECT, INSERT, UPDATE, or DELETE policy for
-- any role. RLS is enabled with zero policies, so every direct PostgREST
-- access — including a user reading their own rows — is denied outright.
-- Sprint 10.4 needs this table only for server-side rate-limit accounting;
-- there is no usage-history UI to support, so no SELECT policy is added on
-- spec. Adding one later, if a "X of 100 used today" indicator is ever
-- built, is a single additive policy — no data migration.
--
-- The two SECURITY DEFINER functions below still read and write this table
-- freely despite zero policies: a SECURITY DEFINER function runs with the
-- privileges of its owner, and table owners bypass RLS by default unless
-- FORCE ROW LEVEL SECURITY is set (it is not, here) — so the functions are
-- the only path in or out of this table, by construction, not by convention.
--
-- This is stricter than every other table in this project (which allow
-- direct client INSERT under RLS), because this table's integrity — accurate
-- counting — is itself a security property: a client with direct table
-- access could otherwise fabricate 'succeeded' rows to free concurrency
-- slots it doesn't hold, or spam 'started' rows for another purpose
-- entirely.

-- Reserves one AI usage slot for the calling user, or reports why not.
-- Atomic: the advisory lock (scoped to this transaction, auto-released at
-- commit) serializes concurrent reservation attempts for the SAME user only
-- — a classic Postgres idiom for capping concurrent rows matching a
-- predicate, which a plain SELECT-then-INSERT cannot do safely under
-- concurrent transactions (a phantom-read race: two concurrent transactions
-- can both see the same "under the cap" count before either commits).
--
-- Limits are parameters with Beta-policy defaults, not hardcoded constants,
-- so a future Free/Pro split changes only what the caller passes in — this
-- function stays plan-agnostic.
create or replace function public.reserve_ai_usage(
  p_tool text,
  p_limit_10m int default 15,
  p_limit_hour int default 50,
  p_limit_day int default 100,
  p_max_concurrent int default 2
)
returns table (
  allowed boolean,
  reservation_id uuid,
  reason text,
  retry_after_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  -- Any AI route's own maxDuration is 60s; 90s gives a 30s buffer so a
  -- crashed or timed-out invocation's orphaned 'started' row stops counting
  -- against the concurrency cap on its own, without needing a cleanup job.
  v_stale_cutoff timestamptz := v_now - interval '90 seconds';
  v_in_flight int;
  v_count int;
  v_oldest timestamptz;
  v_new_id uuid;
begin
  if v_user_id is null then
    return query select false, null::uuid, 'unauthenticated', null::int;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select count(*) into v_in_flight
  from public.ai_usage_events s
  where s.user_id = v_user_id
    and s.event_type = 'started'
    and s.created_at > v_stale_cutoff
    and not exists (
      select 1 from public.ai_usage_events r
      where r.reservation_id = s.id
    );

  if v_in_flight >= p_max_concurrent then
    return query select false, null::uuid, 'concurrency_limit', 5;
    return;
  end if;

  select count(*), min(created_at) into v_count, v_oldest
  from public.ai_usage_events
  where user_id = v_user_id and event_type = 'started'
    and created_at > v_now - interval '10 minutes';
  if v_count >= p_limit_10m then
    return query select false, null::uuid, 'rate_limit_10m',
      greatest(1, ceil(extract(epoch from (v_oldest + interval '10 minutes' - v_now))))::int;
    return;
  end if;

  select count(*), min(created_at) into v_count, v_oldest
  from public.ai_usage_events
  where user_id = v_user_id and event_type = 'started'
    and created_at > v_now - interval '1 hour';
  if v_count >= p_limit_hour then
    return query select false, null::uuid, 'rate_limit_hour',
      greatest(1, ceil(extract(epoch from (v_oldest + interval '1 hour' - v_now))))::int;
    return;
  end if;

  select count(*), min(created_at) into v_count, v_oldest
  from public.ai_usage_events
  where user_id = v_user_id and event_type = 'started'
    and created_at > v_now - interval '1 day';
  if v_count >= p_limit_day then
    return query select false, null::uuid, 'rate_limit_day',
      greatest(1, ceil(extract(epoch from (v_oldest + interval '1 day' - v_now))))::int;
    return;
  end if;

  insert into public.ai_usage_events (user_id, tool, event_type)
  values (v_user_id, p_tool, 'started')
  returning id into v_new_id;

  return query select true, v_new_id, null::text, null::int;
end;
$$;

revoke all on function public.reserve_ai_usage from public, anon;
grant execute on function public.reserve_ai_usage to authenticated;

-- Closes out a reservation this same user opened. Ownership is re-derived
-- from auth.uid(), not trusted from the caller, so a reservation can only
-- ever be resolved by the user who opened it.
create or replace function public.resolve_ai_usage(
  p_reservation_id uuid,
  p_outcome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if p_outcome not in ('succeeded', 'failed') then
    raise exception 'invalid outcome: %', p_outcome;
  end if;

  insert into public.ai_usage_events (user_id, tool, event_type, reservation_id)
  select s.user_id, s.tool, p_outcome, s.id
  from public.ai_usage_events s
  where s.id = p_reservation_id
    and s.user_id = v_user_id
    and s.event_type = 'started';
end;
$$;

revoke all on function public.resolve_ai_usage from public, anon;
grant execute on function public.resolve_ai_usage to authenticated;
