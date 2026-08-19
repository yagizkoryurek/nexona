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
 * Supabase emails a numeric token alongside the usual link; the app reads the
 * token and ignores the link, which is why this project needs no URL scheme,
 * deep-link handling, or in-app browser. `purpose` selects which verifyOtp type
 * runs, since the two flows differ only in that and in where they go next:
 *
 * - signup   -> verification establishes a real session, and the root guard
 *               swaps this whole group out for the tabs. Nothing to navigate.
 * - recovery -> verification establishes a short-lived recovery session that
 *               only authorises setting a new password, so this pushes on to
 *               the reset screen.
 */
export default function VerifyScreen() {
  const { verifySignUp, verifyPasswordReset, requestPasswordReset } = useAuth();

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
   * Re-sends a recovery code. Offered only for recovery: re-sending a signup
   * confirmation needs the password, which this screen never receives, so a
   * user who needs a fresh confirmation goes back and signs up again rather
   * than being given a button that cannot work.
   *
   * Supabase rate limits these sends, so a throttled retry surfaces as the
   * generic failure rather than claiming another email went out.
   */
  async function onResend() {
    if (resending || pending) return;

    setFormError(undefined);
    setNotice(undefined);
    setResending(true);

    const { error } = await requestPasswordReset(email);

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

      {isRecovery ? (
        <AuthLink
          label={resending ? 'Sending…' : 'Send a new code'}
          disabled={resending || pending}
          onPress={onResend}
        />
      ) : null}

      <AuthLink
        label="Back"
        disabled={pending}
        onPress={() => router.back()}
      />
    </AuthScreen>
  );
}
