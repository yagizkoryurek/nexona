import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

/**
 * Keeps the access token current while the app is in the foreground.
 *
 * This is the mobile stand-in for the web's middleware, which calls `getUser()`
 * on every matched request and rotates cookies before a page renders. There is
 * no such interceptor here, so the SDK's refresh timer is started and stopped
 * explicitly: ticking it while the app is backgrounded would refresh a token
 * nobody is using, and never starting it would let a session go stale in place.
 */
function useAutoRefreshWhileActive() {
  useEffect(() => {
    if (AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
}

/**
 * Declarative route protection via expo-router's own `Stack.Protected`.
 *
 * Both groups are always declared and the guards are mutually exclusive, so the
 * router — not a screen calling `router.replace()` in an effect — decides which
 * group is reachable. A signed-out user cannot navigate into `(tabs)` and a
 * signed-in user cannot navigate back into `(auth)`; this is the same shape as
 * the web middleware's PROTECTED_PREFIXES / AUTH_ONLY_PATHS pair.
 *
 * While `loading`, neither guard is satisfied and the splash overlay stays up —
 * this avoids the flash of the sign-in screen that would otherwise appear for
 * the moment it takes to read the persisted session off disk.
 */
function RootNavigator() {
  const { session, loading } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!loading && Boolean(session)}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={!loading && !session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useAutoRefreshWhileActive();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
