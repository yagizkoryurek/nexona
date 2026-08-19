import { router } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthField,
  AuthScreen,
} from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';
import {
  hasErrors,
  validateResetPassword,
  type FieldErrors,
  type ResetPasswordField,
} from '@/lib/auth-validation';

/**
 * Set a new password, reached only after a recovery code has been verified —
 * the recovery session established by that step is what authorises this.
 *
 * `updatePassword` signs the user out afterwards (same as the web reset flow),
 * so this screen returns to sign-in rather than into the app: the new password
 * gets exercised immediately instead of being taken on trust.
 */
export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ResetPasswordField>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    if (pending) return;

    setFormError(undefined);
    const nextErrors = validateResetPassword({ password, confirmPassword });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    const { error } = await updatePassword(password);
    setPending(false);

    if (error) {
      setFormError(error);
      return;
    }

    // The recovery session is gone now, so there is nothing to navigate away
    // from — confirm, then send them back to the start of the stack.
    setDone(true);
  }

  if (done) {
    return (
      <AuthScreen
        title="Password updated"
        subtitle="Sign in with your new password to continue.">
        <AuthButton
          label="Back to sign in"
          pendingLabel="Back to sign in"
          pending={false}
          onPress={() => router.dismissTo('/')}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="New password"
      subtitle="Choose a password you haven't used before."
      error={formError}>
      <AuthField
        label="New password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
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
        error={errors.confirmPassword}
        placeholder="Repeat your new password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!pending}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />

      <AuthButton
        label="Update password"
        pendingLabel="Updating…"
        pending={pending}
        onPress={onSubmit}
      />

      <ThemedText type="small" themeColor="textSecondary">
        You&apos;ll be signed out and asked to sign in with your new password.
      </ThemedText>
    </AuthScreen>
  );
}
