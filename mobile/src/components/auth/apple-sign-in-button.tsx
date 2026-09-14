import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth-context';
import { webBaseUrl } from '@/lib/env';

/**
 * "Sign in with Apple", plus the consent line that goes with it.
 *
 * Shared by the two signed-out screens rather than duplicated, with
 * `buttonType` the only thing that differs between them — Apple renders
 * "Sign in with Apple" on one and "Sign up with Apple" on the other.
 *
 * **Apple's own `AppleAuthenticationButton`, never a custom `Pressable`.**
 * Apple's Human Interface Guidelines constrain the title, logo, colours and
 * proportions of this button; the system one is automatically compliant,
 * localized to the device language, and accessible. A hand-rolled lookalike is
 * an App Review risk for no gain. That constraint is also why `buttonStyle` and
 * `cornerRadius` are used instead of `backgroundColor` and `borderRadius` —
 * Apple's component ignores the latter by design.
 *
 * This renders its own errors nowhere: it hands them to the parent, which owns
 * the single `FormError` region for the screen. Two error surfaces on one form
 * is worse than one.
 */

type Props = {
  buttonType: AppleAuthentication.AppleAuthenticationButtonType;
  /** True while the screen's own email form is submitting. */
  disabled: boolean;
  /** Lets the screen lock its email form while Apple's sheet is up. */
  onPendingChange: (pending: boolean) => void;
  /** `undefined` clears the screen's error — used when a run starts. */
  onError: (message?: string) => void;
};

export function AppleSignInButton({
  buttonType,
  disabled,
  onPendingChange,
  onError,
}: Props) {
  const { signInWithApple } = useAuth();
  const scheme = useColorScheme();

  // `isAvailableAsync` is async, so this starts false and the button appears
  // once the check resolves. Starting true would flash a button on a device
  // that cannot use it.
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;

    // Resolves false rather than throwing when the native module is absent, so
    // no platform guard is needed around the call itself.
    AppleAuthentication.isAvailableAsync()
      .then((result) => {
        if (active) setAvailable(result);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  // iOS-only by construction. The explicit Platform check also keeps the web
  // target (react-native-web is a dependency) from rendering a control whose
  // native module does not exist there.
  if (Platform.OS !== 'ios' || !available) return null;

  async function onPress() {
    if (pending || disabled) return;

    onError(undefined);
    setPending(true);
    onPendingChange(true);

    const { error, cancelled } = await signInWithApple();

    // On success this screen is being unmounted by the root guard, so clearing
    // state would be churn — but cancellation and failure both leave the user
    // here, and the form has to become usable again.
    if (error || cancelled) {
      setPending(false);
      onPendingChange(false);
    }

    // A cancellation is the user's own choice, so it deliberately surfaces
    // nothing at all.
    if (error) onError(error);
  }

  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
        // Apple's button must contrast with the surface behind it, so the
        // colour inverts with the scheme rather than being pinned.
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={10}
        // Without explicit width and height the native button does not render
        // at all. 44pt is Apple's minimum tap target.
        style={[styles.button, (pending || disabled) && styles.buttonDisabled]}
        onPress={onPress}
      />

      {/*
        Consent is disclosed inline rather than gated behind a checkbox the way
        the email sign-up's `AuthCheckbox` is. Apple Sign-In is a one-tap flow
        by design, and interrupting it with a tick box is both unusual on iOS
        and at odds with what Apple's button promises. The email path keeps its
        checkbox — this adds a second consent surface, it does not relax the
        first.

        Both links point at the pinned `webBaseUrl` rather than `apiBaseUrl`,
        for the reason documented in lib/env.ts: `apiBaseUrl` points at a LAN
        dev server during development, and these must be the published pages in
        every build. `ExternalLink` opens them in an in-app browser.
      */}
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.disclosure}>
        By continuing, you agree to our{' '}
        <ExternalLink href={`${webBaseUrl}/terms`}>
          {/*
            `type="small"` with the link colour applied directly, rather than
            `type="linkPrimary"` as Settings uses. That type carries
            `lineHeight: 30`, which is right for a standalone link row but
            inflates the leading of the sentence it sits inside here.
          */}
          <ThemedText type="small" style={styles.link}>
            Terms of Service
          </ThemedText>
        </ExternalLink>{' '}
        and{' '}
        <ExternalLink href={`${webBaseUrl}/privacy`}>
          <ThemedText type="small" style={styles.link}>
            Privacy Policy
          </ThemedText>
        </ExternalLink>
        .
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  button: { height: 44, width: '100%' },
  buttonDisabled: { opacity: 0.6 },
  disclosure: { textAlign: 'center' },
  // The same blue as `linkPrimary` and the primary button, kept in sync by
  // hand because the palette lives in `constants/theme.ts` as scheme colours
  // and this accent is not one of them.
  link: { color: '#3c87f7' },
});
