import { Stack } from 'expo-router';

/**
 * The signed-out area: sign-in, sign-up, and the password-recovery screens.
 *
 * A plain Stack so the recovery flow (request a code -> enter it -> set a new
 * password) can be pushed and popped normally, with the OS back gesture
 * working as users expect.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
