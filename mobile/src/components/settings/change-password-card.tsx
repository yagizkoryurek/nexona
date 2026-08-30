import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthField, AuthLink, FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  hasErrors,
  OTP_LENGTH,
  validateOtp,
  validateResetPassword,
  type FieldErrors,
  type ResetPasswordField,
} from '@/lib/auth-validation';

/**
 * Change your password from Settings, without leaving the signed-in area.
 *
 * The whole OTP flow runs here rather than handing off to the `(auth)` screens,
 * and that is forced rather than chosen: `app/_layout.tsx` guards that group
 * with `!session`, so a signed-in user cannot navigate to `/forgot-password`,
 * `/verify` or `/reset-password` at all. This is the mobile analogue of the web
 * middleware's AUTH_ONLY_PATHS problem, which the web settings page works around
 * the same way — by calling the action directly instead of linking to the page.
 *
 * Every step calls the same `AuthContext` method the corresponding `(auth)`
 * screen calls, so the two paths cannot drift in behaviour or in error copy.
 *
 * One difference from `(auth)/reset-password.tsx` worth knowing: that screen can
 * show a "Password updated" panel afterwards, because the sign-out leaves the
 * session null and the auth group stays mounted. Here the guard flips the other
 * way and unmounts this screen with the rest of the signed-in area, so there is
 * nowhere for a confirmation to render — hence the warning line before the fact,
 * and no `router` call anywhere in this file.
 */

type Phase = 'idle' | 'code' | 'password';

export function ChangePasswordCard({ email }: { email: string }) {
  const { requestPasswordReset, verifyPasswordReset, updatePassword } =
    useAuth();

  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const [token, setToken] = useState('');
  const [tokenError, setTokenError] = useState<string>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<
    FieldErrors<ResetPasswordField>
  >({});

  function reset() {
    setPhase('idle');
    setToken('');
    setTokenError(undefined);
    setPassword('');
    setConfirmPassword('');
    setPasswordErrors({});
    setFormError(undefined);
    setNotice(undefined);
  }

  async function onSendCode() {
    if (pending) return;

    setFormError(undefined);
    setNotice(undefined);
    setPending(true);

    const { error } = await requestPasswordReset(email);
    setPending(false);

    if (error) {
      setFormError(error);
      return;
    }

    setPhase('code');
  }

  /**
   * Re-sends the code. Supabase rate limits these, so a throttled retry surfaces
   * as the generic failure rather than claiming another email went out — same
   * handling, and the same notice copy, as the `(auth)/verify` screen.
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

  async function onVerifyCode() {
    if (pending) return;

    setFormError(undefined);
    setNotice(undefined);

    const invalid = validateOtp(token);
    setTokenError(invalid);
    if (invalid) return;

    setPending(true);
    const { error } = await verifyPasswordReset(email, token);
    setPending(false);

    if (error) {
      setFormError(error);
      return;
    }

    setPhase('password');
  }

  async function onUpdatePassword() {
    if (pending) return;

    setFormError(undefined);
    setNotice(undefined);

    const nextErrors = validateResetPassword({ password, confirmPassword });
    setPasswordErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    const { error } = await updatePassword(password);

    if (error) {
      setPending(false);
      setFormError(error);
      return;
    }

    // Leave `pending` set: `updatePassword` signs out, so the root guard is
    // about to unmount this screen and there is nothing to reset it for.
  }

  return (
    <View style={styles.card}>
      {formError ? <FormError message={formError} /> : null}

      {phase === 'idle' ? (
        <PrimaryButton
          label="Send reset code"
          pendingLabel="Sending…"
          pending={pending}
          onPress={onSendCode}
        />
      ) : null}

      {phase === 'code' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            We emailed a {OTP_LENGTH}-digit code to {email}.
          </ThemedText>

          <AuthField
            label="Verification code"
            value={token}
            onChangeText={(value) => {
              // Digits only, capped at the expected length: pasted codes often
              // arrive with stray spaces.
              setToken(value.replace(/\D/g, '').slice(0, OTP_LENGTH));
            }}
            error={tokenError}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={OTP_LENGTH}
            editable={!pending}
            onSubmitEditing={onVerifyCode}
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

          <PrimaryButton
            label="Verify code"
            pendingLabel="Verifying…"
            pending={pending}
            onPress={onVerifyCode}
          />

          <AuthLink
            label={resending ? 'Sending…' : 'Send a new code'}
            disabled={resending || pending}
            onPress={onResend}
          />

          <AuthLink label="Cancel" disabled={pending} onPress={reset} />
        </>
      ) : null}

      {phase === 'password' ? (
        <>
          <AuthField
            label="New password"
            value={password}
            onChangeText={setPassword}
            error={passwordErrors.password}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!pending}
          />

          <AuthField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={passwordErrors.confirmPassword}
            placeholder="Repeat your new password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!pending}
            onSubmitEditing={onUpdatePassword}
            returnKeyType="go"
          />

          <PrimaryButton
            label="Update password"
            pendingLabel="Updating…"
            pending={pending}
            onPress={onUpdatePassword}
          />

          <ThemedText type="small" themeColor="textSecondary">
            You&apos;ll be signed out and asked to sign in with your new
            password.
          </ThemedText>

          <AuthLink label="Cancel" disabled={pending} onPress={reset} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
});
