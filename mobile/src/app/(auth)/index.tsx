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
  validateSignIn,
  type FieldErrors,
  type SignInField,
} from '@/lib/auth-validation';

/**
 * Sign in — the landing screen for a signed-out user.
 *
 * No redirect on success: `onAuthStateChange` updates the session, which flips
 * the guard in app/_layout.tsx and swaps this group out for the tabs. Pushing a
 * route here as well would fight the router for control.
 */
export default function SignInScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<SignInField>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    if (pending) return;

    setFormError(undefined);
    const nextErrors = validateSignIn({ email, password });
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setPending(true);
    const { error } = await signIn(email, password);
    // Only clear pending on failure: on success this screen is being unmounted
    // by the guard, and setting state on the way out is pointless churn.
    if (error) {
      setFormError(error);
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to continue with Nexona."
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
      />

      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        editable={!pending}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />

      <AuthButton
        label="Sign in"
        pendingLabel="Signing in…"
        pending={pending}
        onPress={onSubmit}
      />

      <AuthLink
        label="Forgot your password?"
        disabled={pending}
        onPress={() => router.push('/forgot-password')}
      />

      <AuthLink
        label="New to Nexona? Create an account"
        disabled={pending}
        onPress={() => router.push('/sign-up')}
      />
    </AuthScreen>
  );
}
