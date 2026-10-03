"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GOOGLE_SIGN_IN_ERROR } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

import { signInWithGoogle } from "./auth-actions";

/** Underlined inline link for the Terms of Service and Privacy Policy. */
export const legalLinkStyles = cn(
  "text-foreground rounded-sm underline underline-offset-4 transition-colors hover:opacity-70",
  "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
  "motion-reduce:transition-none",
);

/**
 * Runs `signInWithGoogle` and tracks it, for a form that also has its own
 * submit. The form folds `pending` into its busy state, so the email fields and
 * the Google button can never both be in flight — the same rule the mobile
 * screens apply to their Apple button.
 *
 * `pending` stays true through success, because success is a navigation away to
 * Google rather than a resolved promise.
 */
export function useGoogleSignIn({
  next,
  onError,
}: {
  next?: string;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = React.useTransition();

  const start = () => {
    onError(null);
    startTransition(async () => {
      // The action handles Supabase failures itself; this catches the request
      // to the server never completing (offline), which would otherwise leave
      // the button stuck on its pending label.
      const result = await signInWithGoogle(next).catch(() => ({
        error: GOOGLE_SIGN_IN_ERROR,
      }));
      if (result?.error) onError(result.error);
    });
  };

  return { pending, start };
}

type GoogleSignInButtonProps = {
  /** "Sign in with Google" or "Sign up with Google", to match the screen. */
  label: string;
  pending: boolean;
  /** Inert without claiming to be working — while the email form submits. */
  disabled?: boolean;
  onClick: () => void;
};

/**
 * Google sign-in, plus the consent line that goes with it.
 *
 * Consent is disclosed inline rather than gated behind the sign-up form's
 * checkbox, as the mobile Apple button does: Google creates the account on
 * return, so the checkbox above it is never reached. The email path keeps its
 * checkbox — this adds a second consent surface, it does not relax the first.
 *
 * `type="button"` and an `onClick`, never a form `action`. A native form post
 * that redirects off-origin can be refused by the CSP's `form-action 'self'`;
 * an action invoked from script navigates to Google instead.
 */
export function GoogleSignInButton({
  label,
  pending,
  disabled = false,
  onClick,
}: GoogleSignInButtonProps) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onClick}
        disabled={pending || disabled}
        className="h-11 w-full px-6"
      >
        {pending ? (
          <>
            <Loader2
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
            Redirecting to Google…
          </>
        ) : (
          <>
            <GoogleLogo />
            {label}
          </>
        )}
      </Button>

      <p className="text-muted-foreground text-center text-sm leading-relaxed">
        By continuing, you agree to our{" "}
        <Link href="/terms" className={legalLinkStyles}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={legalLinkStyles}>
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Google's multicolour "G", as Google's branding guidelines require for a
 * sign-in button. Inline rather than an `<img>`, so it needs no asset and no
 * change to the CSP's `img-src 'self'`.
 */
function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-4">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
