import Link from "next/link";
import { MailCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type ForgotPasswordSuccessProps = {
  /** Echoed back so the user can spot a typo without retyping. */
  email: string;
  /** Returns to the form, e.g. if the address was wrong. */
  onRetry: () => void;
};

/**
 * Mocked confirmation shown after the reset form is submitted. No email is
 * sent — this exists so the success state is designed and reviewed now rather
 * than bolted on once a backend arrives.
 */
export function ForgotPasswordSuccess({
  email,
  onRetry,
}: ForgotPasswordSuccessProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        aria-hidden="true"
        className="border-border/60 bg-foreground/[0.04] text-foreground inline-flex size-12 items-center justify-center rounded-full border"
      >
        <MailCheck className="size-5" />
      </span>

      {/*
        `role="status"` announces the swap to screen-reader users, who would
        otherwise get no signal that the form was replaced.
      */}
      <p role="status" className="text-foreground mt-5 text-base font-medium">
        Check your email
      </p>

      <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-pretty">
        If an account exists for{" "}
        <span className="text-foreground font-medium break-all">{email}</span>,
        we&apos;ve sent a link to reset your password.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "text-muted-foreground hover:text-foreground mt-6 rounded-sm text-sm transition-colors",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
          "motion-reduce:transition-none",
        )}
      >
        Use a different email
      </button>

      <Link
        href="/sign-in"
        className={cn(
          "text-foreground mt-3 rounded-sm text-sm font-medium transition-colors hover:opacity-70",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
          "motion-reduce:transition-none",
        )}
      >
        Back to Sign In
      </Link>
    </div>
  );
}
