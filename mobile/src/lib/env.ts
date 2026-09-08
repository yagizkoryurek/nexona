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

/**
 * Public site origin, for the published Privacy Policy and Terms of Service.
 *
 * Deliberately NOT `apiBaseUrl`, and deliberately not overridable by an
 * environment variable. `apiBaseUrl` is pointed at a LAN `next dev` server
 * during development, and the legal pages a user — or an App Review reviewer —
 * opens must be the published ones in every build, not whatever a developer
 * machine happens to be serving. Pinning it means what is checked on device is
 * what ships.
 *
 * The consequence to know: if the deployed origin ever changes, these links
 * 404 silently in release builds. Changing it is a one-line edit here.
 */
export const webBaseUrl = 'https://nexona-nine.vercel.app';

/**
 * Marks an auth email as mobile-initiated, so the Supabase email templates send
 * a 6-digit code instead of the web's confirmation link.
 *
 * One Supabase project serves both clients and there is one template per email
 * type, so the template has to decide which format to render from what the
 * client sends. Both templates branch on an exact match:
 *
 *   {{ if eq .RedirectTo "<this value>" }} code {{ else }} link {{ end }}
 *
 * Three things about it are load-bearing:
 *
 * - **It must be sent, not omitted.** An earlier attempt branched on
 *   `{{ if .RedirectTo }}`, expecting the variable to be empty because this app
 *   passed no redirect. It is not: GoTrue substitutes the Site URL when the
 *   client omits one, so the link branch always ran and mobile users received a
 *   link they could not use. Every call that triggers an auth email must pass
 *   this — `signUp`, `resendSignUp` and `requestPasswordReset` in
 *   lib/auth-context.tsx. Missing one silently reverts that path to a link.
 * - **It must be on Supabase's Redirect URLs allowlist.** A `redirect_to` that
 *   is not allowlisted is discarded and replaced with the Site URL, with no
 *   error to the caller — reproducing the exact bug above from a different
 *   cause.
 * - **It must match the template byte for byte**, including the absence of a
 *   trailing slash, because the template compares with `eq`.
 *
 * Pinned rather than derived from `apiBaseUrl` for the same reason `webBaseUrl`
 * is: `apiBaseUrl` points at a LAN dev server during development, and a value
 * that varies per environment could never match a fixed string in the template.
 * Nothing ever navigates here — the mobile branch renders no link at all — so
 * this is a discriminator, not a destination.
 */
export const otpRedirectSentinel = 'https://nexona-nine.vercel.app/auth/app';
