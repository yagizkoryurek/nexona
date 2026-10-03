"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cooldownKey,
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  startResendCooldown,
  useResendCooldown,
} from "@/hooks/use-resend-cooldown";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-errors";

import { AuthAlert } from "./auth-alert";
import { AuthCheckEmail } from "./auth-check-email";
import { AuthDivider } from "./auth-divider";
import { AuthField } from "./auth-field";
import { AuthSubmitButton } from "./auth-submit-button";
import {
  GoogleSignInButton,
  legalLinkStyles,
  useGoogleSignIn,
} from "./google-sign-in-button";
import { PasswordInput } from "./password-input";
import { resendSignUp, signUp } from "./auth-actions";
import { signUpSchema, type SignUpValues } from "./auth-schemas";

export function SignUpForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [resendPending, setResendPending] = React.useState(false);
  const [resendNotice, setResendNotice] = React.useState<string | null>(null);
  const [resendError, setResendError] = React.useState<string | null>(null);

  const cooldown = useResendCooldown(
    sentTo ? cooldownKey("signup", sentTo) : null,
  );

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
  const google = useGoogleSignIn({ onError: setFormError });
  // Either path in flight locks the other: both end in a session for one user.
  const busy = pending || google.pending;
  const termsError = form.formState.errors.terms?.message;

  const onSubmit = async (values: SignUpValues) => {
    setFormError(null);
    const result = await signUp(values);

    if (result?.error) {
      setFormError(result.error);
      return;
    }

    // A confirmation email just went out, so the resend button starts locked
    // rather than inviting an immediate second send.
    startResendCooldown(
      cooldownKey("signup", values.email),
      DEFAULT_RESEND_COOLDOWN_SECONDS,
    );
    setSentTo(values.email);
  };

  const handleResend = async () => {
    if (!sentTo || resendPending || cooldown.isActive) return;

    setResendNotice(null);
    setResendError(null);
    setResendPending(true);

    // The action handles Supabase failures itself; this catches the request to
    // the server never completing (offline), which would otherwise leave the
    // button stuck on "Sending…".
    const result = await resendSignUp(sentTo).catch(() => ({
      error: GENERIC_AUTH_ERROR,
      retryAfterSeconds: undefined,
    }));

    setResendPending(false);
    // Locked after every attempt, failed ones included: a network blip must not
    // turn into a burst of sends. A confirmed rate limit locks for longer.
    cooldown.start(result.retryAfterSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS);

    if (result.error) {
      setResendError(result.error);
      return;
    }

    setResendNotice("We sent another email. It may take a minute to arrive.");
  };

  const handleRetry = () => {
    setSentTo(null);
    setResendNotice(null);
    setResendError(null);
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
        onResend={handleResend}
        resendLabel="Resend confirmation email"
        resendPending={resendPending}
        resendCooldownSeconds={cooldown.remainingSeconds}
        resendNotice={resendNotice}
        resendError={resendError}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <form
        noValidate
        aria-busy={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
                  disabled={busy}
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

        <AuthSubmitButton
          pending={pending}
          pendingLabel="Creating account…"
          disabled={google.pending}
        >
          Create Account
        </AuthSubmitButton>

        <AuthDivider />

        <GoogleSignInButton
          label="Sign up with Google"
          pending={google.pending}
          disabled={pending}
          onClick={google.start}
        />
      </form>
    </FormProvider>
  );
}
