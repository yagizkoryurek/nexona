"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { AuthAlert } from "./auth-alert";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
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
        aria-busy={pending}
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
              disabled={pending}
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
              disabled={pending}
              className="h-11"
            />
          )}
        </AuthField>

        <AuthSubmitButton pending={pending} pendingLabel="Signing in…">
          Sign In
        </AuthSubmitButton>
      </form>
    </FormProvider>
  );
}
