"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { AuthAlert } from "./auth-alert";
import { AuthCheckEmail } from "./auth-check-email";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import { PasswordInput } from "./password-input";
import { signUp } from "./auth-actions";
import { signUpSchema, type SignUpValues } from "./auth-schemas";

const legalLinkStyles = cn(
  "text-foreground rounded-sm underline underline-offset-4 transition-colors hover:opacity-70",
  "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4",
  "motion-reduce:transition-none",
);

export function SignUpForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      // Typed as `true` by the schema, but the box starts unchecked — the user
      // has to actively accept, which is the whole point of the control.
      terms: false as unknown as true,
    },
  });

  const pending = form.formState.isSubmitting;
  const termsError = form.formState.errors.terms?.message;

  const onSubmit = async (values: SignUpValues) => {
    setFormError(null);
    const result = await signUp(values);

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

  // The account exists but cannot be used until the emailed link is clicked,
  // so there is nowhere to redirect to yet.
  if (sentTo) {
    return (
      <AuthCheckEmail
        email={sentTo}
        onRetry={handleRetry}
        description={(address) => (
          <>
            We&apos;ve sent a confirmation link to {address}. Click it to
            activate your account and sign in.
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

        <AuthField<SignUpValues> name="name" label="Full name">
          {(field) => (
            <Input
              {...field}
              {...form.register("name")}
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              disabled={pending}
              className="h-11"
            />
          )}
        </AuthField>

        <AuthField<SignUpValues> name="email" label="Email">
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

        <AuthField<SignUpValues> name="password" label="Password">
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

        <AuthField<SignUpValues>
          name="confirmPassword"
          label="Confirm password"
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

        {/*
          Radix's Checkbox is not a native input, so it needs Controller rather
          than register. Laid out by hand instead of via AuthField because the
          label sits beside the control, not above it.
        */}
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <Controller
              control={form.control}
              name="terms"
              render={({ field }) => (
                <Checkbox
                  id="terms"
                  name={field.name}
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                  onBlur={field.onBlur}
                  disabled={pending}
                  aria-invalid={Boolean(termsError)}
                  aria-describedby={termsError ? "terms-message" : undefined}
                  className="mt-0.5"
                />
              )}
            />
            <Label
              htmlFor="terms"
              className="text-muted-foreground text-sm leading-relaxed font-normal"
            >
              <span>
                I agree to the{" "}
                <Link href="/terms" className={legalLinkStyles}>
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className={legalLinkStyles}>
                  Privacy Policy
                </Link>
                .
              </span>
            </Label>
          </div>

          {termsError ? (
            <p id="terms-message" className="text-destructive text-sm">
              {termsError}
            </p>
          ) : null}
        </div>

        <AuthSubmitButton pending={pending} pendingLabel="Creating account…">
          Create Account
        </AuthSubmitButton>
      </form>
    </FormProvider>
  );
}
