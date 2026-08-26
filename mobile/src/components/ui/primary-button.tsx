import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The filled call-to-action used by the dashboard tools.
 *
 * Same treatment as `AuthButton` in components/auth/auth-form.tsx, which is not
 * exported for reuse outside the auth screens. This one lived inside the Resume
 * Analyzer screen while that was the only tool; the ATS Check is the second
 * consumer, so it moves here.
 *
 * `pendingLabel` doubles as the accessibility label while pending, so a screen
 * reader announces the busy state rather than the idle one.
 */
export function PrimaryButton({
  label,
  pendingLabel,
  pending,
  onPress,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={pending}
      accessibilityRole="button"
      accessibilityState={{ disabled: pending, busy: pending }}
      accessibilityLabel={pending ? pendingLabel : label}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        pending && styles.buttonDisabled,
      ]}>
      {pending ? (
        <View style={styles.buttonBusy}>
          <ActivityIndicator color="#ffffff" size="small" />
          <ThemedText type="smallBold" style={styles.buttonText}>
            {pendingLabel}
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="smallBold" style={styles.buttonText}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  buttonText: { color: '#ffffff' },
});
