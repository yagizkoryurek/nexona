// Required until `ui/button.tsx` carries its own "use client": the `radix-ui`
// barrel it imports has no client directive, so pulling Button into a Server
// Component crashes the build with `createContext is not a function`.
"use client";

import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WelcomeScreenProps = {
  /** Whatever the user gave at sign-up; absent for accounts created without it. */
  name?: string;
  email?: string;
};

/**
 * What a user lands on immediately after authenticating.
 *
 * Two states on one route: a welcome panel that acknowledges the sign-in, and
 * the workspace surface behind it. "Continue" swaps between them in place
 * rather than navigating — the real dashboard route arrives in a later sprint,
 * and inventing one now would move redirect targets the auth flow depends on.
 */
export function WelcomeScreen({ name, email }: WelcomeScreenProps) {
  const [entered, setEntered] = React.useState(false);
  const workspaceHeadingRef = React.useRef<HTMLHeadingElement>(null);

  // A real navigation would land the user on the new page's heading; this swap
  // has to do that itself, or focus stays on a button that no longer exists.
  React.useEffect(() => {
    if (entered) {
      workspaceHeadingRef.current?.focus();
    }
  }, [entered]);

  const firstName = name?.trim().split(" ")[0];

  return (
    <div className="w-full max-w-md">
      <div className="border-border/60 bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur-md sm:p-8">
        {/*
          Keyed so the incoming panel replays the entrance animation; without it
          React reuses the subtree and the transition passes unnoticed.
        */}
        <div
          key={entered ? "workspace" : "welcome"}
          className={cn(
            "flex flex-col items-center text-center",
            "animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out",
            "motion-reduce:animate-none",
          )}
        >
          {entered ? (
            <>
              <h1
                ref={workspaceHeadingRef}
                tabIndex={-1}
                className="text-foreground text-2xl font-semibold tracking-tight outline-none"
              >
                Your workspace
              </h1>

              <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
                You&apos;re all set. There&apos;s nothing here yet — this is
                where your dashboard will live.
              </p>

              <SignOutButton className="mt-7 w-full sm:w-auto" />
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="border-border/60 bg-foreground/[0.04] text-foreground inline-flex size-12 items-center justify-center rounded-full border"
              >
                <Sparkles className="size-5" />
              </span>

              <h1 className="text-foreground mt-5 text-2xl font-semibold tracking-tight text-balance">
                {firstName
                  ? `Welcome to Nexona, ${firstName}`
                  : "Welcome to Nexona"}
              </h1>

              <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
                You&apos;re signed in as{" "}
                <span className="text-foreground font-medium break-all">
                  {email}
                </span>
                . Everything is ready when you are.
              </p>

              <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setEntered(true)}
                  className="h-11 w-full px-6 sm:w-auto"
                >
                  Continue
                  <ArrowRight aria-hidden="true" />
                </Button>

                <SignOutButton className="w-full sm:w-auto" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
