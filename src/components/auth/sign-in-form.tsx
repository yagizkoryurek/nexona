"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { GOOGLE_SIGN_IN_ERROR } from "@/lib/auth-errors";
import { cn } from "@/lib/utils";

import { AuthAlert } from "./auth-alert";
import { AuthDivider } from "./auth-divider";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import { GoogleSignInButton, useGoogleSignIn } from "./google-sign-in-button";
import { PasswordInput } from "./password-input";
import { signIn } from "./auth-actions";
import { signInSchema, type SignInValues } from "./auth-schemas";

/** One-off messages other flows hand off through the query string. */
const NOTICES = {
  "reset-success": {
    variant: "info",
    message: "Your password has been updated. Sign in with your new password.",
  },
  "link-invalid": {
    variant: "error",
    message:
      "That link is invalid or has expired. Request a new one and try again.",
  },
  "account-deleted": {
    variant: "info",
    message:
      "Your account and all of its data have been permanently deleted. Thanks for trying Nexona.",
  },
  "oauth-cancelled": {
    variant: "info",
    message: "Sign in with Google was cancelled. You can try again below.",
  },
  "oauth-failed": {
    variant: "error",
    message: GOOGLE_SIGN_IN_ERROR,
  },
} as const;

type SignInFormProps = {
  /** Where to land after signing in, set when a guard bounced the user here. */
  next?: string;
  notice?: string;
};

export function SignInForm({ next, notice }: SignInFormProps) {
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    // Errors wait until a field is left, then clear as soon as it is fixed.
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const pending = form.formState.isSubmitting;
  const google = useGoogleSignIn({ next, onError: setFormError });
  // Either path in flight locks the other: both end in a session for one user.
  const busy = pending || google.pending;
  const activeNotice =
    notice && notice in NOTICES
      ? NOTICES[notice as keyof typeof NOTICES]
      : null;

  const onSubmit = async (values: SignInValues) => {
    setFormError(null);
    // Resolves only on failure — success redirects from the server.
    const result = await signIn(values, next);
    if (result?.error) setFormError(result.error);
  };

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-busy={busy}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}

        {!formError && activeNotice ? (
          <AuthAlert variant={activeNotice.variant}>
            {activeNotice.message}
          </AuthAlert>
        ) : null}

        <AuthField<SignInValues> name="email" label="Email">
          {(field) => (
            <Input
              {...field}
              {...form.register("email")}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={busy}
              className="h-11"
            />
          )}
        </AuthField>

        <AuthField<SignInValues>
          name="password"
          label="Password"
          labelAction={
            <Link
              href="/forgot-password"
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-sm text-sm transition-colors",
                "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
                "motion-reduce:transition-none",
              )}
            >
              Forgot password?
            </Link>
          }
        >
          {(field) => (
            <PasswordInput
              {...field}
              {...form.register("password")}
              autoComplete="current-password"
              disabled={busy}
              className="h-11"
            />
          )}
        </AuthField>

        <AuthSubmitButton
          pending={pending}
          pendingLabel="Signing in…"
          disabled={google.pending}
        >
          Sign In
        </AuthSubmitButton>

        <AuthDivider />

        <GoogleSignInButton
          label="Sign in with Google"
          pending={google.pending}
          disabled={pending}
          onClick={google.start}
        />
      </form>
    </FormProvider>
  );
}
