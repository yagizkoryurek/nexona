import { router } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthField,
  AuthLink,
  AuthScreen,
} from '@/components/auth/auth-form';
import { useAuth } from '@/lib/auth-context';
import {
  hasErrors,
  validateForgotPassword,
  type FieldErrors,
  type ForgotPasswordField,
} from '@/lib/auth-validation';

/**
 * Request a password-recovery code.
 *
 * Always advances to the code-entry screen on success, whether or not the
 * address has an account — matching the web flow, which shows the same panel
 * either way so the form cannot be used to discover which addresses are
 * registered.
 */
export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ForgotPasswordField>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (pending) return;

    setFormError(undefined);
    const nextErrors = validateForgotPassword({ email });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    const { error } = await requestPasswordReset(email);
    setPending(false);

    if (error) {
      setFormError(error);
      return;
    }

    router.push({
      pathname: '/verify',
      params: { email: email.trim(), purpose: 'recovery' },
    });
  }

  return (
    <AuthScreen
      title="Reset password"
      subtitle="We'll email you a code to set a new password."
      error={formError}>
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        editable={!pending}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />

      <AuthButton
        label="Send code"
        pendingLabel="Sending…"
        pending={pending}
        onPress={onSubmit}
      />

      <AuthLink
        label="Back to sign in"
        disabled={pending}
        onPress={() => router.back()}
      />
    </AuthScreen>
  );
}
