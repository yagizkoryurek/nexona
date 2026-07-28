// Required until `ui/button.tsx` carries its own "use client": the `radix-ui`
// barrel it imports has no client directive, so pulling Button into a Server
// Component crashes the build with `createContext is not a function`.
"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OverviewProps = {
  /** Whatever the user gave at sign-up; absent for accounts created without it. */
  name?: string;
  email?: string;
};

/**
 * The dashboard landing surface: acknowledges the session and points at the
 * one tool that exists. Sign-out lives in the sidebar footer now, so it is
 * deliberately absent here.
 */
export function Overview({ name, email }: OverviewProps) {
  const firstName = name?.trim().split(" ")[0];

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md">
        <div className="border-border/60 bg-background/60 rounded-2xl border p-6 shadow-sm backdrop-blur-md sm:p-8">
          <div
            className={cn(
              "flex flex-col items-center text-center",
              "animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out",
              "motion-reduce:animate-none",
            )}
          >
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

            <Button
              asChild
              size="lg"
              className="mt-7 h-11 w-full px-6 sm:w-auto"
            >
              <Link href="/dashboard/resume-analyzer">
                Open Resume Analyzer
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
