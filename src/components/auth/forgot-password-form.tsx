"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";

import { AuthAlert } from "./auth-alert";
import { AuthCheckEmail } from "./auth-check-email";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import { requestPasswordReset } from "./auth-actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "./auth-schemas";

export function ForgotPasswordForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "" },
  });

  const pending = form.formState.isSubmitting;

  const onSubmit = async (values: ForgotPasswordValues) => {
    setFormError(null);
    const result = await requestPasswordReset(values);

    if (result?.error) {
      setFormError(result.error);
      return;
    }

    setSentTo(values.email);
  };

  const handleRetry = () => {
    setSentTo(null);
    form.reset();
  };

  // Shown whether or not the address has an account — a difference here would
  // let anyone test which emails are registered.
  if (sentTo) {
    return (
      <AuthCheckEmail
        email={sentTo}
        onRetry={handleRetry}
        description={(address) => (
          <>
            If an account exists for {address}, we&apos;ve sent a link to reset
            your password.
          </>
        )}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-busy={pending}
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-5"
      >
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}

        <AuthField<ForgotPasswordValues> name="email" label="Email">
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

        <AuthSubmitButton pending={pending} pendingLabel="Sending link…">
          Send Reset Link
        </AuthSubmitButton>
      </form>
    </FormProvider>
  );
}
