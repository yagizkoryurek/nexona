import { router } from 'expo-router';
import { useState } from 'react';

import {
  AuthButton,
  AuthCheckbox,
  AuthField,
  AuthLink,
  AuthScreen,
} from '@/components/auth/auth-form';
import { useAuth } from '@/lib/auth-context';
import {
  hasErrors,
  validateSignUp,
  type FieldErrors,
  type SignUpField,
} from '@/lib/auth-validation';

/**
 * Create an account.
 *
 * Success does not sign the user in — the account is unusable until the emailed
 * code is verified — so this pushes the code-entry screen rather than relying on
 * a session appearing. `name` is collected because the web sign-up requires it
 * and stores it as `full_name`; omitting it here would leave mobile-created
 * accounts subtly different.
 */
export default function SignUpScreen() {
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<SignUpField>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (pending) return;

    setFormError(undefined);
    const nextErrors = validateSignUp({
      name,
      email,
      password,
      confirmPassword,
      terms,
    });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    const { error } = await signUp(name, email, password);
    setPending(false);

    if (error) {
      setFormError(error);
      return;
    }

    // The email carries a code, not a link the app can receive — so the next
    // step is entering it here. `purpose` tells the shared screen which
    // verifyOtp type to use.
    router.push({
      pathname: '/verify',
      params: { email: email.trim(), purpose: 'signup' },
    });
  }

  return (
    <AuthScreen
      title="Create account"
      subtitle="Start getting specific, useful feedback on your résumé."
      error={formError}>
      <AuthField
        label="Name"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        editable={!pending}
      />

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
      />

      <AuthField
        label="Password"
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
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        placeholder="Repeat your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!pending}
      />

      <AuthCheckbox
        label="I agree to the Terms of Service and Privacy Policy"
        checked={terms}
        onToggle={() => setTerms((value) => !value)}
        error={errors.terms}
      />

      <AuthButton
        label="Create account"
        pendingLabel="Creating account…"
        pending={pending}
        onPress={onSubmit}
      />

      <AuthLink
        label="Already have an account? Sign in"
        disabled={pending}
        onPress={() => router.back()}
      />
    </AuthScreen>
  );
}
