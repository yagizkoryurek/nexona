import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A small inline marker — a status, a severity, a priority, or a per-row note
 * in the analysis picker.
 *
 * This lived inside the ATS Check screen while that was its only consumer. The
 * shared analysis picker is the second, so it moves here rather than being
 * copied — the same convention `panel.tsx` and `primary-button.tsx` followed.
 *
 * `color` tints the label only. The badge never carries its meaning in colour
 * alone: the label always says what it means, so the tint reinforces rather
 * than encodes it.
 */
export function Badge({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}
      accessibilityRole="text">
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
});
