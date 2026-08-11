/**
 * Required environment variables, validated once instead of asserted away with
 * `!` at seven call sites.
 *
 * The point is *when* this fails. `src/lib/supabase/*` and `src/lib/ai/gemini.ts`
 * sit in the module graph of pages that get prerendered, so a missing value
 * breaks `next build` rather than surfacing as a 500 on a live request. That
 * matters more since production error boundaries landed: a missing Supabase URL
 * throws inside `src/middleware.ts`, which matches the whole dashboard and every
 * auth route, and the error boundary now renders a friendly "Something went
 * wrong" over what is actually a deployment misconfiguration.
 *
 * No Zod here, deliberately. This module is imported by `src/middleware.ts`,
 * which runs in the Edge runtime — pulling a schema library into that bundle to
 * check three strings are non-empty is a bad trade. Plain checks keep it
 * dependency-free.
 */

/**
 * Throws naming the variable, never printing its value — one of these is a
 * server-only secret and error text reaches logs.
 */
function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in (see README). ` +
        `When deploying, set it in the hosting provider's environment settings.`,
    );
  }

  return value;
}

/*
 * Each variable is read as a *literal* `process.env.NAME` expression, and only
 * the resulting value is passed to `required()`.
 *
 * This is not stylistic. Next.js inlines `NEXT_PUBLIC_*` variables into the
 * client bundle by textually replacing `process.env.NEXT_PUBLIC_FOO`, so a
 * dynamic lookup — `process.env[name]` inside a helper — is never substituted
 * and silently evaluates to `undefined` in the browser. A generic
 * `requireEnv("NEXT_PUBLIC_SUPABASE_URL")` helper would therefore break
 * `createBrowserClient` at runtime while looking perfectly correct here.
 */

export const supabaseUrl = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);

export const supabaseAnonKey = required(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

/**
 * `GEMINI_API_KEY` is validated lazily, unlike the two above.
 *
 * It is server-only, so it is never inlined into the client bundle and reads as
 * `undefined` in the browser. This module is imported by
 * `src/lib/supabase/client.ts` — the *browser* client — so validating the key at
 * module scope would throw in every client component that touches Supabase,
 * for a variable those components neither need nor can see.
 *
 * Calling this from `lib/ai/gemini.ts` (server-only) preserves the original
 * timing: the check still runs when that module is first loaded, so a missing
 * key fails as early as it did before — just with a message that names it.
 */
export function requireGeminiApiKey(): string {
  return required(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");
}
