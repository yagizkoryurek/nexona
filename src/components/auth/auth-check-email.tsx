import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AuthAlert } from "./auth-alert";

type AuthCheckEmailProps = {
  /** Echoed back so the user can spot a typo without retyping. */
  email: string;
  /**
   * Sentence wrapped around the address. Takes the styled address node so the
   * wording can differ per flow while the treatment stays identical.
   */
  description: (address: React.ReactNode) => React.ReactNode;
  /** Returns to the form, e.g. if the address was wrong. */
  onRetry: () => void;
  retryLabel?: string;
  /**
   * Opt-in "send it again" action. Only sign-up passes it: the recovery panel
   * stays exactly as it was, and a flow that omits this renders no resend UI.
   */
  onResend?: () => void;
  resendLabel?: string;
  resendPending?: boolean;
  /** Seconds left before another send is allowed; 0 when it is allowed now. */
  resendCooldownSeconds?: number;
  resendNotice?: string | null;
  resendError?: string | null;
};

/**
 * Shown after an email is dispatched — account confirmation on sign-up,
 * recovery link on forgot-password. The two flows differ only in wording, so
 * they share one panel.
 */
export function AuthCheckEmail({
  email,
  description,
  onRetry,
  retryLabel = "Use a different email",
  onResend,
  resendLabel = "Resend email",
  resendPending = false,
  resendCooldownSeconds = 0,
  resendNotice,
  resendError,
}: AuthCheckEmailProps) {
  const coolingDown = resendCooldownSeconds > 0;

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
        {description(
          <span className="text-foreground font-medium break-all">
            {email}
          </span>,
        )}
      </p>

      {onResend ? (
        <div className="mt-6 flex w-full flex-col gap-4">
          {resendError ? (
            <AuthAlert className="text-left">{resendError}</AuthAlert>
          ) : resendNotice ? (
            <AuthAlert variant="info" className="text-left">
              {resendNotice}
            </AuthAlert>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onResend}
            disabled={resendPending || coolingDown}
            className="h-11 w-full px-6"
          >
            {resendPending
              ? "Sending…"
              : coolingDown
                ? `${resendLabel} in ${resendCooldownSeconds}s`
                : resendLabel}
          </Button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "text-muted-foreground hover:text-foreground mt-6 rounded-sm text-sm transition-colors",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
          "motion-reduce:transition-none",
        )}
      >
        {retryLabel}
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
