"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { AuthAlert } from "./auth-alert";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import { PasswordInput } from "./password-input";
import { resetPassword } from "./auth-actions";
import { resetPasswordSchema, type ResetPasswordValues } from "./auth-schemas";

/**
 * Second half of the reset flow. No email field: the recovery session created
 * by the emailed link already identifies the account.
 */
export function ResetPasswordForm() {
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const pending = form.formState.isSubmitting;

  const onSubmit = async (values: ResetPasswordValues) => {
    setFormError(null);
    // Resolves only on failure — success signs the recovery session out and
    // redirects to sign-in.
    const result = await resetPassword(values);
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

        <AuthField<ResetPasswordValues> name="password" label="New password">
          {(field) => (
            <PasswordInput
              {...field}
              {...form.register("password")}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              disabled={pending}
              className="h-11"
            />
          )}
        </AuthField>

        <AuthField<ResetPasswordValues>
          name="confirmPassword"
          label="Confirm new password"
        >
          {(field) => (
            <PasswordInput
              {...field}
              {...form.register("confirmPassword")}
              autoComplete="new-password"
              disabled={pending}
              className="h-11"
            />
          )}
        </AuthField>

        <AuthSubmitButton pending={pending} pendingLabel="Updating password…">
          Update Password
        </AuthSubmitButton>
      </form>
    </FormProvider>
  );
}
