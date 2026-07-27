"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";

import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import { ForgotPasswordSuccess } from "./forgot-password-success";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "./auth-schemas";
import { useMockSubmit } from "./use-mock-submit";

export function ForgotPasswordForm() {
  const { pending, settled, submit, reset } = useMockSubmit();

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "" },
  });

  const handleRetry = () => {
    reset();
    form.reset();
  };

  if (settled) {
    return (
      <ForgotPasswordSuccess
        email={form.getValues("email")}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-busy={pending}
        onSubmit={form.handleSubmit(submit)}
        className="flex flex-col gap-5"
      >
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
