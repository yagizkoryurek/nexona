import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth-context';

/**
 * "Sign in with Google" / "Sign up with Google".
 *
 * Shaped like `AppleSignInButton` on purpose — same props, same 44pt height,
 * full width and 10pt corner radius — so the two read as a pair. It sits above
 * the Apple button, whose consent line then covers both; this one renders none
 * of its own.
 *
 * Unlike Apple's, this is a hand-built `Pressable`: Google ships no system
 * button for this flow. Its look follows Google's sign-in branding — the
 * multicolour "G" on white with a grey outline, or on near-black in dark mode —
 * using the app's own type rather than Google's font.
 *
 * Errors go to the parent's single `FormError`, as Apple's do.
 */

type Props = {
  label: string;
  /** True while something else on the screen — the email form or Apple — is busy. */
  disabled: boolean;
  /** Lets the screen lock its other paths while Google's sheet is up. */
  onPendingChange: (pending: boolean) => void;
  /** `undefined` clears the screen's error — used when a run starts. */
  onError: (message?: string) => void;
};

export function GoogleSignInButton({
  label,
  disabled,
  onPendingChange,
  onError,
}: Props) {
  const { signInWithGoogle } = useAuth();
  const scheme = useColorScheme();
  const [pending, setPending] = useState(false);

  // iOS only for now, like Apple's. The redirect relies on iOS's
  // ASWebAuthenticationSession handing the callback back to this call; on
  // Android the same URL would arrive as a deep link the router has no screen
  // for, and the web target has no use for it.
  if (Platform.OS !== 'ios') return null;

  async function onPress() {
    if (pending || disabled) return;

    onError(undefined);
    setPending(true);
    onPendingChange(true);

    const { error, cancelled } = await signInWithGoogle();

    // On success the root guard is unmounting this screen; cancellation and
    // failure leave the user here with a form that must work again.
    if (error || cancelled) {
      setPending(false);
      onPendingChange(false);
    }

    if (error) onError(error);
  }

  const dark = scheme === 'dark';
  const inert = pending || disabled;
  const textColor = { color: dark ? '#E3E3E3' : '#1F1F1F' };

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: pending }}
      accessibilityLabel={pending ? 'Signing in with Google…' : label}
      style={({ pressed }) => [
        styles.button,
        dark ? styles.buttonDark : styles.buttonLight,
        pressed && styles.buttonPressed,
        inert && styles.buttonDisabled,
      ]}>
      {pending ? (
        <View style={styles.content}>
          <ActivityIndicator color={textColor.color} size="small" />
          <ThemedText type="smallBold" style={textColor}>
            Signing in with Google…
          </ThemedText>
        </View>
      ) : (
        <View style={styles.content}>
          <Image
            source={require('@/assets/images/google-g.svg')}
            style={styles.logo}
            accessible={false}
          />
          <ThemedText type="smallBold" style={textColor}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Matches the Apple button's frame in apple-sign-in-button.tsx.
  button: {
    height: 44,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Google's published light and dark sign-in button colours.
  buttonLight: { backgroundColor: '#FFFFFF', borderColor: '#747775' },
  buttonDark: { backgroundColor: '#131314', borderColor: '#8E918F' },
  // Same feedback values as AuthButton and the Apple button.
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 18, height: 18 },
});
