"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthSubmitButtonProps = {
  children: React.ReactNode;
  /** Label swapped in while pending, e.g. "Signing in…". */
  pendingLabel: string;
  pending: boolean;
  className?: string;
};

/**
 * Full-width submit button with a pending state.
 *
 * The label is swapped rather than hidden behind a spinner alone, so the state
 * is conveyed by text as well as motion.
 */
export function AuthSubmitButton({
  children,
  pendingLabel,
  pending,
  className,
}: AuthSubmitButtonProps) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={cn("h-11 w-full px-6", className)}
    >
      {pending ? (
        <>
          <Loader2
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
