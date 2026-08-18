-- Nexona — permanent account deletion
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New
-- query). Safe to re-run: `create or replace` plus idempotent grants.
--
-- MUST be applied as `postgres`, which is what the SQL Editor uses. The
-- function's power comes entirely from its owner: `auth.users` is owned by
-- `supabase_auth_admin` and grants DELETE to only three roles, `postgres`
-- among them (`relacl` = ar*wdDxtm), and `postgres` additionally carries
-- BYPASSRLS. Applied as any other role, this function would be created
-- successfully and then fail at call time with a permission error.
--
-- WHY A FUNCTION AND NOT THE ADMIN API. The conventional way to delete an
-- account is supabase.auth.admin.deleteUser(), which needs the service-role
-- key. This project deliberately has no such key anywhere in its source or
-- environment — every server path uses the anon key plus the caller's own JWT,
-- so RLS is always in force. Introducing a key that bypasses RLS on every
-- table for every user, purely to delete one row, is a far larger grant than
-- the problem needs. This function is the narrow alternative: it can delete
-- exactly one row, chosen by nothing the caller controls.
--
-- NO DELETE POLICIES ARE ADDED, HERE OR ANYWHERE. Every user-owned table
-- already cascades from auth.users (migrations 0001, 0003-0007), so removing
-- the auth.users row removes resume_analyses, ats_audits, cover_letters,
-- career_insights, interview_preps and ai_usage_events with it. Granting
-- row-level DELETE instead would take six policies, would not delete the
-- auth.users row anyway, and would break the AI rate limiter: that limiter's
-- whole guarantee is that a user cannot delete their own 'started' rows to
-- reset a quota. This function bypasses RLS rather than relaxing it, so the
-- "no UPDATE or DELETE policy on any table" property survives intact.
--
-- One honest consequence: deleting an account does drop that user's
-- ai_usage_events rows along with everything else, so someone could reset an
-- AI quota by deleting their account and signing up again. That is not a
-- regression this function introduces — signing up with a second address
-- always did the same — and the price is the irreversible loss of every
-- analysis and generated document. It is not a quota bypass worth defending
-- against by refusing to let people delete their accounts.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
-- Empty, NOT `public` as in migration 0007. That function runs as postgres
-- too, but it only touches tables in public; this one deletes from auth.users
-- with BYPASSRLS in effect, so an attacker who could create an object in an
-- earlier-resolving schema would be shadowing identifiers inside the most
-- privileged function in the database. Every identifier below is therefore
-- schema-qualified. pg_catalog is always searched implicitly, so built-in
-- types and operators still resolve.
set search_path = ''
as $$
declare
  -- The ONLY source of identity. This function takes no parameters at all:
  -- there is no argument for a caller to point at someone else's account, so
  -- deleting another user's data is impossible by construction rather than by
  -- policy. Do not add one.
  v_user_id uuid := auth.uid();
  v_deleted int;
begin
  if v_user_id is null then
    -- 28000 = invalid_authorization_specification. PostgREST maps this to a
    -- 4xx, and the application maps it to a generic message.
    raise exception 'delete_account: no authenticated user'
      using errcode = '28000';
  end if;

  -- Cascades to every public table via their user_id foreign keys, and to
  -- auth.identities/sessions/refresh_tokens within the auth schema.
  delete from auth.users where id = v_user_id;

  get diagnostics v_deleted = row_count;

  -- auth.uid() resolved to a user that no longer exists — a JWT still inside
  -- its validity window for an already-deleted account. Nothing was deleted,
  -- so say so rather than reporting success.
  if v_deleted = 0 then
    raise exception 'delete_account: no such user'
      using errcode = '28000';
  end if;
end;
$$;

-- `public` covers every role, including anon; both are revoked explicitly
-- rather than relying on the default, because this function is destructive and
-- its grants should be readable at a glance. anon has no auth.uid() and would
-- only ever hit the 28000 above, but an unauthenticated role should not hold
-- EXECUTE on account deletion at all.
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
