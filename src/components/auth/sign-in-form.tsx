"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { AuthAlert } from "./auth-alert";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import { PasswordInput } from "./password-input";
import { signInSchema, type SignInValues } from "./auth-schemas";
import { useMockSubmit } from "./use-mock-submit";

export function SignInForm() {
  const { pending, settled, submit } = useMockSubmit();

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    // Errors wait until a field is left, then clear as soon as it is fixed.
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-busy={pending}
        onSubmit={form.handleSubmit(submit)}
        className="flex flex-col gap-5"
      >
        {settled ? (
          <AuthAlert variant="info">
            Your details passed validation. Signing in is not wired up yet —
            authentication arrives in a future sprint.
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
