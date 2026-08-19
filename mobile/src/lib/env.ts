/**
 * Required Expo environment variables, validated once rather than asserted away
 * with `!` at each call site — the mobile counterpart to the web app's
 * `src/lib/env.ts`, and the same reasoning: a missing value should fail loudly
 * and by name, not surface later as an opaque error inside the Supabase client.
 *
 * `EXPO_PUBLIC_*` is Expo's equivalent of Next's `NEXT_PUBLIC_*`: Metro inlines
 * these into the app bundle at build time. Each is therefore read as a *literal*
 * `process.env.EXPO_PUBLIC_NAME` expression — a dynamic lookup like
 * `process.env[name]` is never substituted and would evaluate to `undefined` on
 * device.
 *
 * Both values here are safe to ship in the bundle: the anon key is designed to
 * be public and Row Level Security is what protects the data. GEMINI_API_KEY is
 * deliberately absent — it is server-only and must never reach a mobile bundle,
 * which is why every AI call goes through the web app's /api/mobile/* routes
 * instead of talking to Gemini directly.
 */

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy mobile/.env.example to mobile/.env.local and fill it in.`
    );
  }

  return value;
}

export const supabaseUrl = required(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  'EXPO_PUBLIC_SUPABASE_URL'
);

export const supabaseAnonKey = required(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
);

/**
 * Base URL of the Next.js app hosting the /api/mobile/* routes.
 *
 * Optional: falls back to the deployed origin, which is what a release build
 * should talk to anyway. Set it in .env.local to point a simulator at a local
 * `next dev` server instead.
 */
export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'https://nexona-nine.vercel.app';
