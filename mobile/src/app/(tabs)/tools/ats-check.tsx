import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnalysisPicker } from '@/components/ui/analysis-picker';
import { Badge } from '@/components/ui/badge';
import { ListPanel, Panel, Score } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listAuditableAnalyses, type SelectableAnalysis } from '@/lib/analyses';
import {
  auditResume,
  type AtsAuditBlocker,
  type AtsAuditRecommendation,
  type AtsAuditResult,
  type AtsAuditSection,
  type AtsAuditStatus,
} from '@/lib/ats-audit';

/**
 * ATS Compatibility Check — the mobile counterpart to the web dashboard's tool.
 *
 * Structurally this is the Resume Analyzer's sibling, not its clone. That one
 * uploads a file; this one operates on an analysis the user already has, so it
 * opens with a list rather than a file picker, and the server may answer from a
 * stored audit without calling the model at all.
 *
 * As on the web, this screen never sees a prompt, the extracted resume text, or
 * Gemini. It also never renders a score of its own: the number shown is the ATS
 * score already stored on the analysis, and the audit explains it rather than
 * competing with it.
 */

type Phase =
  | { name: 'select' }
  | { name: 'auditing' }
  | { name: 'results'; analysisId: string; result: AtsAuditResult };

/**
 * Presentation-only ordering. The model returns findings in its own order; the
 * UI decides that the worst things belong at the top. Same convention as web.
 */
const SEVERITY_ORDER: AtsAuditBlocker['severity'][] = [
  'critical',
  'warning',
  'info',
];
const PRIORITY_ORDER: AtsAuditRecommendation['priority'][] = [
  'high',
  'medium',
  'low',
];

/**
 * The web pairs each status with a Lucide icon; this app has no icon set, so
 * the badge carries its meaning in the label and uses colour only to reinforce
 * it — never as the sole signal.
 */
const STATUS_META: Record<AtsAuditStatus, { label: string; color: string }> = {
  pass: { label: 'Pass', color: '#16a34a' },
  warning: { label: 'Needs work', color: '#d97706' },
  fail: { label: 'Failing', color: '#dc2626' },
};

const SEVERITY_META: Record<
  AtsAuditBlocker['severity'],
  { label: string; color: string }
> = {
  critical: { label: 'Critical', color: '#dc2626' },
  warning: { label: 'Warning', color: '#d97706' },
  info: { label: 'Info', color: '#3c87f7' },
};

const PRIORITY_LABEL: Record<AtsAuditRecommendation['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export default function AtsCheckScreen() {
  // `null` means the list has not loaded yet — distinct from an empty list,
  // which is a real and meaningful state here.
  const [analyses, setAnalyses] = useState<SelectableAnalysis[] | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const result = await listAuditableAnalyses();

    if ('error' in result) {
      setError(result.error);
      setAnalyses([]);
      return;
    }

    setAnalyses(result.data);
  }, []);

  // Refetched on focus, not just on mount: a resume analyzed on the Home tab
  // has to appear here without an app restart. Only the list is touched — a
  // user sitting on a result is not yanked back to the picker.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function runAudit(analysisId: string, refresh: boolean) {
    if (phase.name === 'auditing') return;

    setError(undefined);
    setPhase({ name: 'auditing' });

    const result = await auditResume(analysisId, refresh);

    if ('error' in result) {
      // The route phrases its own errors for end users, including rate-limit
      // copy, so this is passed through rather than reworded.
      setError(result.error);
      setPhase({ name: 'select' });
      return;
    }

    // Reflect the new audit in the list so the marker is right on the way back,
    // without paying for a second round-trip.
    setAnalyses(
      (previous) =>
        previous?.map((analysis) =>
          analysis.id === analysisId
            ? { ...analysis, annotation: 'Audited' }
            : analysis
        ) ?? previous
    );

    setPhase({ name: 'results', analysisId, result: result.data });
  }

  function reset() {
    setError(undefined);
    setPhase({ name: 'select' });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary">
              Pick a resume you&apos;ve already analyzed. You&apos;ll get a
              detailed read of how it survives automated screening.
            </ThemedText>

            {error ? <FormError message={error} /> : null}

            {phase.name === 'results' ? (
              <Results
                result={phase.result}
                onRefresh={() => void runAudit(phase.analysisId, true)}
                onReset={reset}
              />
            ) : phase.name === 'auditing' ? (
              <Panel title="Auditing your resume…">
                <ThemedText type="small" themeColor="textSecondary">
                  This usually takes a few seconds.
                </ThemedText>
              </Panel>
            ) : (
              <AnalysisPicker
                analyses={analyses}
                onSelect={(id) => void runAudit(id, false)}
                actionLabel="Audit"
                loadingTitle="Loading your resumes…"
                emptyTitle="Nothing to check yet"
                emptyMessage="You don't have any analyses eligible for an ATS check yet. Analyze a resume on the Home tab first, then come back here for a detailed compatibility audit."
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Results({
  result,
  onRefresh,
  onReset,
}: {
  result: AtsAuditResult;
  onRefresh: () => void;
  onReset: () => void;
}) {
  const { audit } = result;

  const blockers = [...audit.blockers].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
  const recommendations = [...audit.recommendations].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  return (
    <View style={styles.results}>
      <ThemedText type="small" themeColor="textSecondary">
        {result.fileName}
      </ThemedText>

      <View style={styles.scoreRow}>
        <Score
          label="ATS Score"
          value={result.atsScore}
          caption="from your resume analysis"
        />
      </View>

      <Panel title="Summary">
        <ThemedText type="small">{audit.executiveSummary}</ThemedText>
      </Panel>

      {audit.sections.map((section) => (
        <SectionPanel key={section.key} section={section} />
      ))}

      <ChipPanel
        title="Keywords found"
        items={audit.keywords.present}
        emptyMessage="No role-relevant keywords were identified."
      />
      <ChipPanel
        title="Keywords missing"
        items={audit.keywords.missing}
        emptyMessage="Nothing obvious is missing."
      />

      <ListPanel
        title="Missing sections"
        items={audit.missingSections}
        emptyMessage="Every standard resume section is present."
      />

      <Panel title="ATS blockers">
        {blockers.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No ATS blockers found — nothing here would break automated parsing.
          </ThemedText>
        ) : (
          blockers.map((blocker, index) => (
            // Index-keyed: these strings come from a model and are not
            // guaranteed distinct.
            <View key={index} style={styles.entry}>
              <Badge
                label={SEVERITY_META[blocker.severity].label}
                color={SEVERITY_META[blocker.severity].color}
              />
              <ThemedText type="small">{blocker.issue}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {blocker.impact}
              </ThemedText>
            </View>
          ))
        )}
      </Panel>

      <Panel title="Recommendations">
        {recommendations.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No further recommendations.
          </ThemedText>
        ) : (
          recommendations.map((recommendation, index) => (
            <View key={index} style={styles.entry}>
              <Badge label={PRIORITY_LABEL[recommendation.priority]} />
              <ThemedText type="small">{recommendation.action}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {recommendation.rationale}
              </ThemedText>
            </View>
          ))
        )}
      </Panel>

      {!result.persisted ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="alert">
          This audit couldn&apos;t be saved, so it won&apos;t be here next time.
        </ThemedText>
      ) : null}

      <PrimaryButton
        label="Run a fresh audit"
        pendingLabel=""
        pending={false}
        onPress={onRefresh}
      />
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Choose a different resume"
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <ThemedText type="linkPrimary">Choose a different resume</ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * One audited area. Keyed off `section.key`, never `section.label` — the key is
 * a closed enum and the label is model-generated prose.
 */
function SectionPanel({ section }: { section: AtsAuditSection }) {
  const meta = STATUS_META[section.status];

  return (
    <Panel title={section.label}>
      <Badge label={meta.label} color={meta.color} />
      <ThemedText type="small">{section.headline}</ThemedText>

      {section.findings.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing to flag here.
        </ThemedText>
      ) : (
        section.findings.map((finding, index) => (
          <View key={index} style={styles.listItem}>
            <ThemedText type="small" themeColor="textSecondary">
              {'•'}
            </ThemedText>
            <ThemedText type="small" style={styles.listItemText}>
              {finding}
            </ThemedText>
          </View>
        ))
      )}
    </Panel>
  );
}

/** Keywords are short tokens; a bulleted list of single words reads badly. */
function ChipPanel({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  const theme = useTheme();

  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {emptyMessage}
        </ThemedText>
      ) : (
        <View style={styles.chipRow}>
          {items.map((item, index) => (
            <View
              key={index}
              style={[
                styles.chip,
                { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="small">{item}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  pressed: { opacity: 0.85 },
  results: { gap: Spacing.three },
  scoreRow: { flexDirection: 'row', gap: Spacing.three },
  entry: { gap: Spacing.one, marginTop: Spacing.two },
  listItem: { flexDirection: 'row', gap: Spacing.two },
  listItemText: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  secondary: {
    alignItems: 'center',
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
