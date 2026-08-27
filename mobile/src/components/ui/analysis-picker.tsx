import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SelectableAnalysis } from '@/lib/analyses';

/**
 * The list of analyses a tool can act on — the mobile counterpart to the web's
 * `ResumePicker`, and shared by every tool that operates on a stored analysis
 * rather than on a freshly uploaded file.
 *
 * This lived inside the ATS Check screen while that was the only such tool.
 * The Resume Optimizer is the second consumer, so it moves here rather than
 * being copied — the same convention `panel.tsx` and `primary-button.tsx`
 * followed.
 *
 * Eligibility is a stored resume text — see lib/analyses.ts. Analyses that
 * predate that column are absent rather than shown as broken, so the empty
 * state has to explain what to do rather than implying something failed. The
 * copy is per-tool and therefore owned by the caller, exactly as the web
 * picker's `emptyStateDescription` is.
 */

type AnalysisPickerProps = {
  /** `null` means "not loaded yet" — distinct from an empty list, which is a
   * real and meaningful state here. */
  analyses: SelectableAnalysis[] | null;
  onSelect: (id: string) => void;
  /** Verb opening each row's accessibility label, e.g. "Audit", "Optimize". */
  actionLabel: string;
  loadingTitle: string;
  emptyTitle: string;
  emptyMessage: string;
};

export function AnalysisPicker({
  analyses,
  onSelect,
  actionLabel,
  loadingTitle,
  emptyTitle,
  emptyMessage,
}: AnalysisPickerProps) {
  if (analyses === null) {
    return (
      <Panel title={loadingTitle}>
        <ThemedText type="small" themeColor="textSecondary">
          One moment.
        </ThemedText>
      </Panel>
    );
  }

  if (analyses.length === 0) {
    return (
      <Panel title={emptyTitle}>
        <ThemedText type="small" themeColor="textSecondary">
          {emptyMessage}
        </ThemedText>
      </Panel>
    );
  }

  return (
    <View style={styles.pickerList}>
      {analyses.map((analysis) => (
        <AnalysisRow
          key={analysis.id}
          analysis={analysis}
          actionLabel={actionLabel}
          onPress={() => onSelect(analysis.id)}
        />
      ))}
    </View>
  );
}

function AnalysisRow({
  analysis,
  actionLabel,
  onPress,
}: {
  analysis: SelectableAnalysis;
  actionLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  const date = new Date(analysis.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel} ${analysis.fileName}, analyzed ${date}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{analysis.fileName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {date} · Overall {analysis.overallScore} · ATS {analysis.atsScore}
        </ThemedText>
      </View>

      {analysis.annotation ? <Badge label={analysis.annotation} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pickerList: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.one },
  pressed: { opacity: 0.85 },
});
