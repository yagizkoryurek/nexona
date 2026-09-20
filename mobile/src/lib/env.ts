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

import Constants from 'expo-constants';

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
 * Extracts the bare host from Expo's `hostUri` ("<host>:<metro-port>"), which
 * is untrusted-shaped even though it's first-party — defensive rather than a
 * bare `.split(':')[0]`.
 *
 * Handles: a plain host with no port, a bracketed IPv6 literal
 * ("[::1]:8081"), and strips an unexpected scheme or path/query suffix.
 * Refuses to guess on an unbracketed IPv6 host (more than one colon left
 * after the above), since splitting on the first colon would silently
 * truncate it — returns null instead, which falls through to the next
 * precedence tier below rather than building a malformed URL.
 */
function hostFromHostUri(hostUri: string): string | null {
  let value = hostUri.trim();
  if (!value) return null;

  value = value.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, '');
  value = value.split(/[/?#]/)[0];
  if (!value) return null;

  if (value.startsWith('[')) {
    const closing = value.indexOf(']');
    return closing > 0 ? value.slice(0, closing + 1) : null;
  }

  const colonCount = (value.match(/:/g) ?? []).length;
  if (colonCount === 0) return value;
  if (colonCount === 1) return value.split(':')[0];
  return null;
}

/**
 * Derives the local dev API host from Metro's own dev-server address, so a
 * physical device or simulator can reach `next dev` without a hand-maintained
 * LAN IP in .env.local that goes stale on every DHCP lease change.
 *
 * `Constants.expoConfig?.hostUri` is the same "<host>:<metro-port>" address
 * (e.g. "192.168.68.55:8081") the device already used to fetch the JS bundle
 * — so whatever host got the bundle onto the device can also serve the API,
 * given `next dev` binds to all interfaces on port 3000 (confirmed: it does).
 * Only the host is kept; the port is always overridden to 3000 regardless of
 * whatever port Metro itself is using.
 *
 * Guarded by two independent signals, both required, so a single one
 * misbehaving can't leak a LAN URL into a release build:
 * - `__DEV__` is baked into the bundle by the RN/Metro release process itself
 *   and is `false` in every release JS bundle, independent of expo-constants.
 * - `Constants.expoConfig?.hostUri` is documented as present only "during
 *   development using @expo/cli" — undefined in a Standalone/EAS release
 *   build even if `__DEV__` were somehow wrong.
 *
 * Known limitations:
 * - `expo start --tunnel`: `hostUri` becomes a tunnel address where port 3000
 *   is almost certainly not forwarded — this would derive an unreachable URL.
 *   Use the explicit `EXPO_PUBLIC_API_BASE_URL` override in that mode.
 * - `expo start --localhost`: `hostUri` resolves to `localhost`, unreachable
 *   from a physical device — a pre-existing limitation, not a regression.
 * - Assumes `next dev` runs on the same machine as Metro, listening on port
 *   3000 on all interfaces (already true today).
 */
function deriveDevApiBaseUrl(): string | null {
  if (!__DEV__) return null;
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostFromHostUri(hostUri);
  return host ? `http://${host}:3000` : null;
}

/**
 * Base URL of the Next.js app hosting the /api/mobile/* routes.
 *
 * Three-tier precedence:
 * 1. `EXPO_PUBLIC_API_BASE_URL`, if set — wins unconditionally, in dev or
 *    prod. The escape hatch for tunnel mode, a custom port, a different host,
 *    or forcing production while running a dev build.
 * 2. The auto-derived dev host (see `deriveDevApiBaseUrl`) — only applies in
 *    development, and only when Expo actually reports a `hostUri`.
 * 3. The deployed origin, which is what a release build should talk to
 *    anyway and what dev falls back to if `hostUri` is unavailable.
 */
export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  deriveDevApiBaseUrl() ||
  'https://nexona-nine.vercel.app';

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
