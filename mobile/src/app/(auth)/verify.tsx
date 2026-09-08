import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthField,
  AuthLink,
  AuthScreen,
} from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import { OTP_LENGTH, validateOtp } from '@/lib/auth-validation';

/**
 * Shared code-entry screen for both email flows.
 *
 * Supabase emails a numeric token, which is why this project needs no URL
 * scheme, deep-link handling, or in-app browser.
 *
 * One Supabase project serves both clients, so both email templates branch on
 * an exact `{{ .RedirectTo }}` match against `otpRedirectSentinel` (lib/env.ts),
 * which this app sends on every call that triggers an auth email. Web-initiated
 * mail carries the PKCE link; mobile-initiated mail carries the code this screen
 * reads.
 *
 * Note the branch keys on a value mobile *sends*, not on one it omits: GoTrue
 * fills `{{ .RedirectTo }}` with the Site URL when a client passes nothing, so
 * an absence test silently sends mobile users the web link. That was tried and
 * failed.
 *
 * The split matters because `{{ .Token }}` and the link's `{{ .TokenHash }}` are
 * two encodings of ONE single-use token: whichever is used first spends the
 * other. Sending both to the same user is therefore a race, not a convenience —
 * hence the branch, and hence the "Already confirmed?" escape hatch below for
 * anyone who reaches the link some other way.
 *
 * `purpose` selects which verifyOtp type runs, since the two flows differ only
 * in that and in where they go next:
 *
 * - signup   -> verification establishes a real session, and the root guard
 *               swaps this whole group out for the tabs. Nothing to navigate.
 * - recovery -> verification establishes a short-lived recovery session that
 *               only authorises setting a new password, so this pushes on to
 *               the reset screen.
 */
export default function VerifyScreen() {
  const {
    verifySignUp,
    verifyPasswordReset,
    requestPasswordReset,
    resendSignUp,
  } = useAuth();

  const params = useLocalSearchParams<{
    email?: string;
    purpose?: string;
  }>();
  const email = params.email ?? '';
  const isRecovery = params.purpose === 'recovery';

  const [token, setToken] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit() {
    if (pending) return;

    setFormError(undefined);
    setNotice(undefined);

    const invalid = validateOtp(token);
    setFieldError(invalid);
    if (invalid) return;

    setPending(true);
    const { error } = isRecovery
      ? await verifyPasswordReset(email, token)
      : await verifySignUp(email, token);

    if (error) {
      setFormError(error);
      setPending(false);
      return;
    }

    if (isRecovery) {
      setPending(false);
      router.push('/reset-password');
    }
    // Signup: leave `pending` set — the guard is about to unmount this screen.
  }

  /**
   * Re-sends the code, for either flow.
   *
   * Signup used to be excluded here on the grounds that re-sending a
   * confirmation needs the password, which this screen never receives. That is
   * true of `signUp`, but not of `supabase.auth.resend({ type: 'signup' })`,
   * which needs only the address — so the exclusion was unnecessary, and it
   * left a user whose code expired with no way forward but to sign up again.
   *
   * Supabase rate limits these sends, so a throttled retry surfaces as the
   * generic failure rather than claiming another email went out.
   */
  async function onResend() {
    if (resending || pending) return;

    setFormError(undefined);
    setNotice(undefined);
    setResending(true);

    const { error } = isRecovery
      ? await requestPasswordReset(email)
      : await resendSignUp(email);

    setResending(false);

    if (error) {
      setFormError(error);
      return;
    }
    setNotice('We sent another code. It may take a minute to arrive.');
  }

  return (
    <AuthScreen
      title="Enter your code"
      subtitle={
        email
          ? `We emailed a ${OTP_LENGTH}-digit code to ${email}.`
          : `Enter the ${OTP_LENGTH}-digit code from your email.`
      }
      error={formError}>
      <AuthField
        label="Verification code"
        value={token}
        onChangeText={(value) => {
          // Digits only, capped at the expected length: pasted codes often
          // arrive with stray spaces.
          setToken(value.replace(/\D/g, '').slice(0, OTP_LENGTH));
        }}
        error={fieldError}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        editable={!pending}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />

      {notice ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="alert">
          {notice}
        </ThemedText>
      ) : null}

      <AuthButton
        label={isRecovery ? 'Verify code' : 'Confirm account'}
        pendingLabel="Verifying…"
        pending={pending}
        onPress={onSubmit}
      />

      <AuthLink
        label={resending ? 'Sending…' : 'Send a new code'}
        disabled={resending || pending}
        onPress={onResend}
      />

      {/*
        Signup only, and it is not merely a convenience. The emailed code and
        the emailed link are one single-use token, so a user who opened the
        link has already confirmed their account and every code they type here
        will now fail. "Back" would return them to sign-up, which then errors
        with `user_already_exists` — a dead end for someone whose account is
        actually fine. `dismissTo('/')` unwinds the auth stack to sign-in, the
        same call the reset-password screen uses to get there.
      */}
      {isRecovery ? null : (
        <AuthLink
          label="Already confirmed? Sign in"
          disabled={pending}
          onPress={() => router.dismissTo('/')}
        />
      )}

      <AuthLink
        label="Back"
        disabled={pending}
        onPress={() => router.back()}
      />
    </AuthScreen>
  );
}
