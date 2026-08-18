import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Guards the security properties of account deletion.
 *
 * Everything that makes this feature safe lives in SQL — a SECURITY DEFINER
 * function that runs with BYPASSRLS and can delete a row from `auth.users`.
 * No test in this repository can execute that function (there is no local
 * Postgres and no test database), so these assertions read the migration and
 * the Server Action as text and check the properties that must never drift.
 *
 * That is a weaker guarantee than executing it, and deliberately not presented
 * as more: these catch a future edit that removes a revoke, loosens
 * `search_path`, or adds a user-id parameter. Proving the function actually
 * deletes the right row still requires the live checks in the task's
 * verification section.
 *
 * Runs on Node's built-in runner, same as `resume-text-extraction.test.ts` —
 * this repository has no test framework and adding one is its own decision.
 */

const migration = readFileSync(
  join(
    import.meta.dirname,
    "../../../supabase/migrations/0009_delete_account.sql",
  ),
  "utf8",
);

const action = readFileSync(
  join(import.meta.dirname, "delete-account-action.ts"),
  "utf8",
);

/**
 * The migration explains its own reasoning at length, and that prose mentions
 * the very things these tests assert are absent — `service_role`, DELETE
 * policies, `search_path = public`. Asserting against the raw file would let a
 * comment fail a test, or worse, let a comment satisfy one. Strip them first so
 * every assertion below is about executable SQL only.
 */
function sqlWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/**
 * The same hazard in TypeScript. The action's own doc comment explains that
 * auth decisions never use `getSession()` — asserting that string is absent
 * from the raw file therefore fails on the comment that documents the rule it
 * is checking. `(?<!:)` keeps a `//` inside a URL from being treated as the
 * start of a comment.
 */
function tsWithoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(?<!:)\/\/[^\n]*/g, " ");
}

const sql = sqlWithoutComments(migration);
const code = tsWithoutComments(action);

test("the function takes no parameters at all", () => {
  // The core containment: with no argument list there is nothing for a caller
  // to put another user's id into, so deleting someone else's account is
  // impossible by construction rather than by policy.
  assert.match(
    sql,
    /create\s+or\s+replace\s+function\s+public\.delete_account\s*\(\s*\)/i,
    "delete_account must be declared with an empty parameter list",
  );

  assert.doesNotMatch(
    sql,
    /function\s+public\.delete_account\s*\(\s*[^)\s]/i,
    "delete_account must never take a parameter",
  );
});

test("identity comes only from auth.uid()", () => {
  assert.match(
    sql,
    /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/i,
    "the user must be derived from auth.uid()",
  );
});

test("the function is SECURITY DEFINER with an empty search_path", () => {
  assert.match(sql, /security\s+definer/i);

  assert.match(
    sql,
    /set\s+search_path\s*=\s*''/i,
    "search_path must be empty, not inherited",
  );

  // Migration 0007's functions use `search_path = public`. This one runs with
  // BYPASSRLS against auth.users, so that would be a real shadowing risk.
  assert.doesNotMatch(
    sql,
    /set\s+search_path\s*=\s*public/i,
    "search_path must not be set to public",
  );
});

test("it deletes only the derived user's own auth.users row", () => {
  assert.match(
    sql,
    /delete\s+from\s+auth\.users\s+where\s+id\s*=\s*v_user_id/i,
    "the delete must be schema-qualified and scoped to the derived user",
  );

  // Exactly one delete statement — nothing else should be reached directly,
  // since every user-owned table cascades from auth.users.
  const deletes = sql.match(/\bdelete\s+from\b/gi) ?? [];
  assert.equal(deletes.length, 1, "expected exactly one DELETE statement");
});

test("execute is revoked from public and anon, and granted only to authenticated", () => {
  assert.match(
    sql,
    /revoke\s+all\s+on\s+function\s+public\.delete_account\s*\(\s*\)\s+from\s+public\s*,\s*anon\s*;/i,
  );

  assert.match(
    sql,
    /grant\s+execute\s+on\s+function\s+public\.delete_account\s*\(\s*\)\s+to\s+authenticated\s*;/i,
  );

  // The only grant in this migration. A `to public`, `to anon` or `to
  // service_role` here would widen who can destroy an account.
  const grants = sql.match(/\bgrant\s+[\s\S]*?;/gi) ?? [];
  assert.equal(grants.length, 1, "expected exactly one GRANT");
});

test("the migration adds no RLS policy and no service-role dependency", () => {
  // The whole point of the definer function is that it bypasses RLS instead of
  // relaxing it, preserving the project's no-UPDATE/DELETE-policy model.
  assert.doesNotMatch(sql, /create\s+policy/i, "must not create any policy");
  assert.doesNotMatch(sql, /for\s+delete/i, "must not add a DELETE policy");
  assert.doesNotMatch(
    sql,
    /alter\s+table[\s\S]*?row\s+level\s+security/i,
    "must not alter row level security",
  );
  assert.doesNotMatch(sql, /service_role/i, "must not reference service_role");
});

test("the Server Action calls the RPC with no arguments", () => {
  assert.match(
    code,
    /\.rpc\(\s*"delete_account"\s*\)/,
    "the RPC must be invoked with no argument object",
  );

  // The failure this guards against: someone later "helpfully" passing the id
  // the action already has in scope, turning a structurally safe call into one
  // whose safety depends on the SQL ignoring it.
  assert.doesNotMatch(
    code,
    /\.rpc\(\s*"delete_account"\s*,/,
    "the RPC must never be passed arguments",
  );
});

test("the Server Action re-verifies the user and never uses a service-role key", () => {
  assert.match(
    code,
    /auth\.getUser\(\)/,
    "the action must re-verify with getUser()",
  );

  assert.doesNotMatch(
    code,
    /getSession\(/,
    "auth decisions must never use getSession()",
  );

  assert.doesNotMatch(
    code,
    /service_role|SERVICE_ROLE|serviceRole|auth\.admin/,
    "the action must not use the service-role key or Admin API",
  );
});

test("the Server Action clears the session and redirects to sign-in", () => {
  assert.match(code, /auth\.signOut\(\)/, "the session must be cleared");

  assert.match(
    code,
    /redirect\(\s*"\/sign-in\?notice=account-deleted"\s*\)/,
    "success must redirect to the sign-in page",
  );
});
