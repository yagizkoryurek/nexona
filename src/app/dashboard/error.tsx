"use client";

import Link from "next/link";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { Button } from "@/components/ui/button";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Error boundary for everything inside the dashboard shell.
 *
 * Nested under `dashboard/layout.tsx`, so the sidebar and header survive the
 * failure and the user stays oriented in the app rather than being dropped onto
 * a bare page. That is the whole reason this exists separately from the root
 * boundary.
 *
 * `reset()` is genuinely useful here, unlike on a static page: every dashboard
 * route opens with one to three Supabase round trips, and a transient failure
 * on any of them usually succeeds on a second attempt.
 *
 * Mirrors the tool pages' own shell — centred, `max-w-3xl`, the same `<h1>`
 * scale — so the failure state sits where the tool would have.
 */
export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>

      <div className="mt-7 w-full">
        <DashboardPanel>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            This page couldn&rsquo;t be loaded. Your saved analyses and results
            are unaffected — nothing has been lost.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              onClick={reset}
              size="lg"
              className="h-11 w-full px-6 sm:w-auto"
            >
              Try again
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 w-full px-6 sm:w-auto"
            >
              <Link href="/dashboard">Back to overview</Link>
            </Button>
          </div>

          {/* See the root boundary: the digest is the only handle linking a
              report to the server log that explains it. */}
          {error.digest ? (
            <p className="text-muted-foreground mt-6 text-xs">
              Reference:{" "}
              <span className="font-mono select-all">{error.digest}</span>
            </p>
          ) : null}
        </DashboardPanel>
      </div>
    </div>
  );
}
