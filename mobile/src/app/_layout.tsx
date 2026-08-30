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

        {/*
          Settings sits beside the tab group rather than inside it: `AppTabs` is
          NativeTabs, which expects a trigger per route in its group, so a route
          under `(tabs)` would mean a third tab or a hidden trigger. Here it
          pushes over the tab bar with a native header, and stays behind the
          same guard as everything else signed-in.

          `headerBackButtonDisplayMode: 'minimal'` renders the chevron alone.
          Without it iOS labels the back button with the previous route's title,
          and the screen behind this one is the `(tabs)` group — which has no
          title, so the label falls back to the raw route name and reads
          "(tabs)". The tools stack sets the same option on every tool screen
          for the same reason, so this also keeps the two headers consistent.
        */}
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Settings',
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
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
