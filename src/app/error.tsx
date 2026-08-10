"use client";

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { DecorativeBackdrop } from "@/components/decorative-backdrop";
import { NavbarBrand } from "@/components/navbar/navbar-brand";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Catches render and data errors across the public surface — the landing page,
 * `(legal)`, `(company)` and `(auth)` — anything without a closer boundary.
 * An error boundary must be a Client Component; that is a framework
 * requirement, not a choice.
 *
 * Wears the auth screens' lighter chrome (backdrop plus wordmark) rather than
 * the full Navbar and Footer. Those would be pulled into the client bundle here
 * for a page that is only ever a dead end, and a broken page does not need
 * marketing navigation — it needs one clear way to recover.
 *
 * The copy is deliberately plain. The product voice is direct and a little wry
 * elsewhere, which reads badly at the moment something has just failed, and it
 * says nothing about the cause: `error.message` can carry internals and is not
 * safe to show.
 */
export default function GlobalRouteError({ error, reset }: ErrorBoundaryProps) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <DecorativeBackdrop />

      <header className="flex justify-center px-4 pt-8 sm:px-6 sm:pt-10">
        <NavbarBrand />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <AuthCard
          title="Something went wrong"
          description="An unexpected error stopped this page from loading. Trying again often works — the problem is usually temporary."
          footer={
            <p className="text-muted-foreground text-center text-sm">
              Still stuck?{" "}
              <Link
                href="/contact"
                className="text-foreground focus-visible:outline-ring rounded-sm font-medium transition-colors hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
              >
                Report it
              </Link>
            </p>
          }
        >
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={reset}
              size="lg"
              className="h-11 w-full px-6"
            >
              Try again
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 w-full px-6"
            >
              <Link href="/">Back to home</Link>
            </Button>
          </div>

          {/*
            The digest is a short hash Next assigns to the server-side error and
            writes to the server log. With no error-tracking service in this
            project, it is the only thing tying a user's bug report to the log
            line that explains it — so it is shown, quietly, rather than hidden.
          */}
          {error.digest ? (
            <p className="text-muted-foreground mt-6 text-center text-xs">
              Reference:{" "}
              <span className="font-mono select-all">{error.digest}</span>
            </p>
          ) : null}
        </AuthCard>
      </main>
    </div>
  );
}
