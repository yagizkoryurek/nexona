"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Last-resort boundary for a failure in the root layout itself.
 *
 * This one *replaces* `app/layout.tsx`, so it has to supply its own `<html>`
 * and `<body>` — and, critically, it cannot rely on anything that layout sets
 * up: the Geist font variables and `globals.css` (which defines every design
 * token, `bg-background`, `text-foreground` and the rest) may never have been
 * applied. A Tailwind class here would silently resolve to nothing.
 *
 * So this file is deliberately self-contained and styled inline, and imports no
 * project component. It is the one place in the codebase where duplicating a
 * little styling is correct rather than lazy: reusing the design system is
 * exactly what cannot be trusted at this point. It should look plain — if a
 * user ever sees it, something is badly wrong and legibility beats polish.
 *
 * `color-scheme` plus the two `light-dark()` values are what keep it readable
 * in either theme without a stylesheet.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          colorScheme: "light dark",
          background: "light-dark(#ffffff, #0a0a0a)",
          color: "light-dark(#0a0a0a, #fafafa)",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Nexona
          </p>

          <h1
            style={{
              margin: "1.5rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              opacity: 0.7,
            }}
          >
            Nexona failed to load. This is usually temporary — reloading often
            resolves it.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              minWidth: "10rem",
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: "pointer",
              borderRadius: "0.5rem",
              border: "1px solid light-dark(#e5e5e5, #262626)",
              background: "light-dark(#0a0a0a, #fafafa)",
              color: "light-dark(#fafafa, #0a0a0a)",
            }}
          >
            Try again
          </button>

          {error.digest ? (
            <p
              style={{
                margin: "1.5rem 0 0",
                fontSize: "0.75rem",
                opacity: 0.6,
              }}
            >
              Reference:{" "}
              <span style={{ fontFamily: "ui-monospace, monospace" }}>
                {error.digest}
              </span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
