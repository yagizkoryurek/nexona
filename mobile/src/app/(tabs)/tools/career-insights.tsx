import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnalysisPicker } from '@/components/ui/analysis-picker';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listInsightfulAnalyses, type SelectableAnalysis } from '@/lib/analyses';
import {
  generateCareerInsights,
  type CareerInsightsResult,
  type CareerNextStep,
  type CareerRoleFit,
  type CareerSkillGap,
} from '@/lib/career-insights';

/**
 * Career Insights — the mobile counterpart to the web dashboard's tool.
 *
 * Structurally the ATS Check's sibling: an artifact keyed to a resume alone
 * converges on one current answer, so the server may serve a stored set without
 * calling the model, and the phase machine is `select → generating → results`
 * rather than the Cover Letter's four phases. There is no target-role or
 * career-goal input — the tool is resume-only by design.
 *
 * Deliberately renders no score of any kind. Unlike the ATS Check there is not
 * even one to render: the stored scores are context the model reasons from and
 * never reach this screen. Adding a `Score` here would undo that containment.
 */

type Phase =
  | { name: 'select' }
  | { name: 'generating' }
  | { name: 'results'; analysisId: string; result: CareerInsightsResult };

/**
 * Presentation-only ordering. The model returns entries in its own order; the
 * UI decides that the most actionable ones lead. Same convention as the ATS
 * Check and as the web's `CareerInsightsResults`.
 */
const FIT_ORDER: CareerRoleFit[] = ['strong', 'possible', 'stretch'];
const IMPACT_ORDER: CareerSkillGap['impact'][] = ['high', 'medium', 'low'];
const PRIORITY_ORDER: CareerNextStep['priority'][] = ['high', 'medium', 'low'];

/**
 * The web pairs each fit with a Lucide icon; this app has no icon set, so the
 * badge carries its meaning in the label alone.
 */
const FIT_LABEL: Record<CareerRoleFit, string> = {
  strong: 'Strong fit',
  possible: 'Possible',
  stretch: 'Stretch',
};

const IMPACT_LABEL: Record<CareerSkillGap['impact'], string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

const PRIORITY_LABEL: Record<CareerNextStep['priority'], string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

export default function CareerInsightsScreen() {
  // `null` means the list has not loaded yet — distinct from an empty list,
  // which is a real and meaningful state here.
  const [analyses, setAnalyses] = useState<SelectableAnalysis[] | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const result = await listInsightfulAnalyses();

    if ('error' in result) {
      setError(result.error);
      setAnalyses([]);
      return;
    }

    setAnalyses(result.data);
  }, []);

  // Refetched on focus, not just on mount: a resume analyzed elsewhere in the
  // app has to appear here without a restart. Only the list is touched — a user
  // sitting on a result is not yanked back to the picker.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function run(analysisId: string, refresh: boolean) {
    if (phase.name === 'generating') return;

    setError(undefined);
    setPhase({ name: 'generating' });

    const result = await generateCareerInsights(analysisId, refresh);

    if ('error' in result) {
      // The route phrases its own errors for end users, including rate-limit
      // copy, so this is passed through rather than reworded.
      setError(result.error);
      setPhase({ name: 'select' });
      return;
    }

    // Reflect the new insights in the list so the marker is right on the way
    // back, without paying for a second round-trip.
    setAnalyses(
      (previous) =>
        previous?.map((analysis) =>
          analysis.id === analysisId
            ? { ...analysis, annotation: 'Insights ready' }
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
              Pick a resume you&apos;ve already analyzed. You&apos;ll get a read
              of where your profile stands, the roles it supports, and what
              would move it forward.
            </ThemedText>

            {error ? <FormError message={error} /> : null}

            {phase.name === 'results' ? (
              <Results
                result={phase.result}
                onRegenerate={() => void run(phase.analysisId, true)}
                onReset={reset}
              />
            ) : phase.name === 'generating' ? (
              <Panel title="Reading your career profile…">
                <ThemedText type="small" themeColor="textSecondary">
                  This usually takes a few seconds.
                </ThemedText>
              </Panel>
            ) : (
              <AnalysisPicker
                analyses={analyses}
                onSelect={(id) => void run(id, false)}
                actionLabel="Get insights for"
                loadingTitle="Loading your resumes…"
                emptyTitle="Nothing to read yet"
                emptyMessage="You don't have any analyses eligible for career insights yet. Analyze a resume first, then come back here for a read of where your profile stands."
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
  onRegenerate,
  onReset,
}: {
  result: CareerInsightsResult;
  onRegenerate: () => void;
  onReset: () => void;
}) {
  const { insights } = result;

  const suitableRoles = [...insights.suitableRoles].sort(
    (a, b) => FIT_ORDER.indexOf(a.fit) - FIT_ORDER.indexOf(b.fit)
  );
  const skillGaps = [...insights.skillGaps].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact)
  );
  const nextSteps = [...insights.nextSteps].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  return (
    <View style={styles.results}>
      <ThemedText type="small" themeColor="textSecondary">
        {result.fileName}
      </ThemedText>

      <Panel title="Your professional position">
        <ThemedText type="small">{insights.positioning}</ThemedText>
      </Panel>

      <Panel title="Strength themes">
        {insights.strengthThemes.map((theme, index) => (
          // Index-keyed: these strings come from a model and are not
          // guaranteed distinct.
          <View key={index} style={styles.entry}>
            <ThemedText type="small">{theme.theme}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {theme.evidence}
            </ThemedText>
          </View>
        ))}
      </Panel>

      <Panel title="Roles you're positioned for">
        {suitableRoles.map((role, index) => (
          <View key={index} style={styles.entry}>
            <Badge label={FIT_LABEL[role.fit]} />
            <ThemedText type="small">{role.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {role.rationale}
            </ThemedText>
          </View>
        ))}
      </Panel>

      <Panel title="Skill gaps">
        {/*
          An empty list is a legitimate, good outcome here — `skillGaps` is the
          one array in the schema with no minimum, so this has to read as an
          answer rather than a blank panel.
        */}
        {skillGaps.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No significant gaps stood out — this profile reads as well-rounded
            for the roles above.
          </ThemedText>
        ) : (
          skillGaps.map((gap, index) => (
            <View key={index} style={styles.entry}>
              <Badge label={IMPACT_LABEL[gap.impact]} />
              <ThemedText type="small">{gap.skill}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {gap.why}
              </ThemedText>
            </View>
          ))
        )}
      </Panel>

      <Panel title="Next steps">
        {nextSteps.map((step, index) => (
          <View key={index} style={styles.entry}>
            <Badge label={PRIORITY_LABEL[step.priority]} />
            <ThemedText type="small">{step.action}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {step.rationale}
            </ThemedText>
          </View>
        ))}
      </Panel>

      {!result.persisted ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="alert">
          These insights couldn&apos;t be saved, so they won&apos;t be here next
          time.
        </ThemedText>
      ) : null}

      <PrimaryButton
        label="Generate again"
        pendingLabel=""
        pending={false}
        onPress={onRegenerate}
      />
      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Choose another resume"
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <ThemedText type="linkPrimary">Choose another resume</ThemedText>
      </Pressable>
    </View>
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
  entry: { gap: Spacing.one, marginTop: Spacing.two },
  secondary: {
    alignItems: 'center',
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
