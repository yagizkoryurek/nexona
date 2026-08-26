import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The card surfaces shared by the dashboard tools — the mobile counterpart to
 * the web's `DashboardPanel` / `ListPanel`.
 *
 * These lived inside the Resume Analyzer screen while it was the only tool.
 * The ATS Check is the second consumer, so they move here rather than being
 * copied — the same convention the web app follows.
 */

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

/**
 * A bulleted list in a panel.
 *
 * `emptyMessage` is required rather than optional on purpose: several of the
 * lists this renders can legitimately be empty, and for those an empty array is
 * the *good* outcome — "no ATS blockers found", not "no data". A panel that
 * silently rendered nothing would read as a bug.
 */
export function ListPanel({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {emptyMessage}
        </ThemedText>
      ) : (
        items.map((item, index) => (
          // Index-keyed: these strings come from a model and are not
          // guaranteed distinct, so the content itself is not a safe key.
          <View key={index} style={styles.listItem}>
            <ThemedText type="small" themeColor="textSecondary">
              {'•'}
            </ThemedText>
            <ThemedText type="small" style={styles.listItemText}>
              {item}
            </ThemedText>
          </View>
        ))
      )}
    </Panel>
  );
}

/**
 * A single 0–100 readout.
 *
 * The web renders these as a `ScoreRing` (an inline SVG). This is a plain
 * numeric readout instead — the app has no SVG dependency, and adding one to
 * draw a circle is not worth it before the rest of the toolkit exists.
 */
export function Score({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption?: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[styles.score, { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="text"
      accessibilityLabel={`${label} score ${value} out of 100`}>
      <ThemedText type="title">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {caption ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.scoreCaption}>
          {caption}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  listItem: { flexDirection: 'row', gap: Spacing.two },
  listItemText: { flex: 1 },
  score: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  scoreCaption: { textAlign: 'center' },
});
