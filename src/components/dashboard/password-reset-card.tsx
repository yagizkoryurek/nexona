// Required until `ui/button.tsx` carries its own "use client": the `radix-ui`
// barrel it imports has no client directive, so pulling Button into a Server
// Component crashes the build with `createContext is not a function`.
"use client";

import * as React from "react";

import { requestPasswordReset } from "@/components/auth/auth-actions";
import { AuthAlert } from "@/components/auth/auth-alert";
import { Button } from "@/components/ui/button";

type PasswordResetCardProps = {
  /**
   * The signed-in address, resolved server-side by the page. Passed down rather
   * than collected from an input: this flow only ever targets the current
   * account, and a field would invite typing someone else's address into it.
   */
  email: string;
};

/**
 * "Send password reset link" — the one security action the existing auth
 * architecture already supports for a signed-in user.
 *
 * It calls `requestPasswordReset` unchanged, the same action `/forgot-password`
 * uses, so the emailed link runs the established recovery flow
 * (`/auth/callback` -> `/reset-password`). Nothing about that flow is modified
 * here. Note the link is browser- and origin-bound, and completing it signs the
 * user out, which is why the copy says so up front.
 *
 * Linking to `/forgot-password` instead would not work: that path is in the
 * middleware's `AUTH_ONLY_PATHS`, so a signed-in user is bounced to the
 * dashboard before the page renders.
 */
export function PasswordResetCard({ email }: PasswordResetCardProps) {
  const [pending, startTransition] = React.useTransition();
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleSend() {
    setError(null);

    startTransition(async () => {
      const result = await requestPasswordReset({ email });

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSent(true);
    });
  }

  // The button does not come back after a successful send. Supabase Auth
  // throttles outgoing mail, so a second click is more likely to burn the
  // remaining allowance than to help.
  if (sent) {
    return (
      <AuthAlert variant="info">
        Check your inbox — we&apos;ve sent a password reset link to{" "}
        <span className="font-medium break-all">{email}</span>. Open it in this
        browser, on this site, or the link won&apos;t work.
      </AuthAlert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <AuthAlert>{error}</AuthAlert> : null}

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleSend}
        disabled={pending}
        className="h-11 w-full px-6 sm:w-auto"
      >
        {pending ? "Sending…" : "Send password reset link"}
      </Button>
    </div>
  );
}
