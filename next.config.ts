import type { NextConfig } from "next";

/**
 * Security headers (audit finding A4: the app previously set none at all).
 *
 * They live here rather than in `src/middleware.ts` on purpose. That
 * middleware's matcher is deliberately narrow — `/dashboard/:path*` plus the
 * auth routes — so headers set there would miss `/`, `/terms` and `/privacy`,
 * which are the highest-traffic public pages and exactly the ones that need
 * clickjacking and referrer protection. `headers()` applies to every response,
 * including redirects and API routes, without widening that matcher and paying
 * a `getUser()` round-trip on public pages.
 */

/** `next dev`'s Fast Refresh evaluates code with `eval` and talks to an HMR websocket. */
const isDev = process.env.NODE_ENV === "development";

/*
 * Each directive below reflects what this app was verified to actually do, not
 * a copied template. Checked against the rendered HTML and the built CSS:
 * no `<img>`/`next/image`, no `data:` URIs in markup or compiled CSS, no
 * iframes, no websockets outside dev, no third-party analytics, and fonts are
 * self-hosted by `next/font/google` at build time rather than fetched from
 * Google's CDN at runtime. So everything resolves to 'self'.
 */
const contentSecurityPolicy = [
  "default-src 'self'",

  /*
   * 'unsafe-inline' is required, and its absence would break the entire app.
   * Next.js streams the React Server Components payload as inline
   * `self.__next_f.push(...)` scripts — 20 of them on the landing page alone —
   * and without this every page would render but never hydrate.
   *
   * The strict alternative is a per-request nonce, which Next.js supports via
   * middleware. It was considered and rejected for now: a nonce is per-request
   * by definition, so `/`, `/terms` and `/privacy` would lose static
   * prerendering and become dynamic, and the middleware matcher would have to
   * widen to every route. That is a real architectural change, not a header
   * tweak.
   *
   * What this policy still buys with 'unsafe-inline' in place: no script may
   * be loaded from an external origin, the app cannot be framed, forms cannot
   * post off-origin, and `<base>` cannot be hijacked. What it does not buy is
   * protection against injected inline script — which is why the "no
   * raw-HTML sink" property (no `dangerouslySetInnerHTML`, no `innerHTML`,
   * verified repo-wide) has to stay true.
   */
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,

  // Radix UI sets inline `style` attributes at runtime for positioning, and
  // Tailwind v4 injects CSS custom properties the same way.
  "style-src 'self' 'unsafe-inline'",

  "img-src 'self'",
  "font-src 'self'",

  /*
   * 'self' only. The browser never calls Supabase or Gemini directly today —
   * every Supabase call runs in a Server Action, Server Component or the
   * mobile route handler, and `src/lib/supabase/client.ts` (the browser
   * client) currently has no callers at all.
   *
   * If that client is ever wired up for a client-side read, this line must
   * gain the Supabase URL or those calls will fail a CSP check.
   */
  `connect-src 'self'${isDev ? " ws:" : ""}`,

  // Nothing in Nexona is meant to be embedded. Supersedes X-Frame-Options in
  // modern browsers; that header stays below for older ones.
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Redundant with `frame-ancestors 'none'` by design, for browsers that
    // predate it.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Sends the full URL same-origin, bare origin cross-origin, nothing on a
    // downgrade to HTTP. Keeps query strings — `?next=`, `?notice=` — off
    // third-party referrer logs.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // An explicit deny for the features this app verifiably never uses,
    // rather than an exhaustive list of every permission the spec defines.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
