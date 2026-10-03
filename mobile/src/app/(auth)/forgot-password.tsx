import { router } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthField,
  AuthLink,
  AuthScreen,
} from '@/components/auth/auth-form';
import {
  cooldownKey,
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  useResendCooldown,
} from '@/hooks/use-resend-cooldown';
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

  // Keyed on the address currently typed, so coming back here and re-entering
  // an address that was just sent a code shows its countdown — and a
  // different address is unaffected.
  const cooldown = useResendCooldown(
    email.trim() ? cooldownKey('recovery', email) : null
  );

  async function onSubmit() {
    // The keyboard's "go" key submits past the disabled button, so the
    // countdown is enforced here too.
    if (pending || cooldown.isActive) return;

    setFormError(undefined);
    const nextErrors = validateForgotPassword({ email });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    const { error, retryAfterSeconds } = await requestPasswordReset(email);
    setPending(false);
    // Locked after every attempt, failed ones included; a confirmed rate
    // limit locks for longer. The verify screen picks this countdown up.
    cooldown.start(retryAfterSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS);

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
        label={
          cooldown.isActive
            ? `Send again in ${cooldown.remainingSeconds}s`
            : 'Send code'
        }
        pendingLabel="Sending…"
        pending={pending}
        disabled={cooldown.isActive}
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
