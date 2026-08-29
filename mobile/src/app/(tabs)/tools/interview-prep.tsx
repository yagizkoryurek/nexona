import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnalysisPicker } from '@/components/ui/analysis-picker';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listPreparableAnalyses, type SelectableAnalysis } from '@/lib/analyses';
import {
  generateInterviewPrep,
  type InterviewPrepResult,
  type InterviewPreparationFocus,
  type InterviewQuestion,
  type InterviewQuestionCategory,
} from '@/lib/interview-prep';

/**
 * Interview Preparation — the mobile counterpart to the web dashboard's tool.
 *
 * The ATS Check's and Career Insights' shape: an artifact keyed to a resume
 * alone converges on one answer, so `select → generating → results` with no
 * second input phase, and the server may serve a stored preparation without
 * calling the model.
 *
 * Renders no number, and unlike every other tool here there is not even one to
 * render: the route never fetches either stored score, so nothing scorelike
 * reaches this screen. That containment is structural — do not "fix" it by
 * displaying a score fetched from somewhere else.
 */

type Phase =
  | { name: 'select' }
  | { name: 'generating' }
  | { name: 'results'; analysisId: string; result: InterviewPrepResult };

/**
 * Presentation-only ordering, same convention as the ATS Check and Career
 * Insights: the model returns its own order, the UI decides the running order.
 *
 * `resumeProbe` sits last on purpose. Those are the uncomfortable questions —
 * gaps, short tenures, transitions — and opening a practice set with them reads
 * as an accusation. Working through the answerable material first and arriving
 * at them is the order a person would actually rehearse in.
 */
const CATEGORY_ORDER: InterviewQuestionCategory[] = [
  'experience',
  'technical',
  'behavioral',
  'resumeProbe',
];

const PRIORITY_ORDER: InterviewPreparationFocus['priority'][] = [
  'high',
  'medium',
  'low',
];

/**
 * The web pairs each category with a Lucide icon; this app has no icon set, so
 * the badge carries its meaning in the label alone.
 */
const CATEGORY_LABEL: Record<InterviewQuestionCategory, string> = {
  behavioral: 'Behavioral',
  technical: 'Technical',
  experience: 'Experience',
  resumeProbe: 'Resume probe',
};

const PRIORITY_LABEL: Record<InterviewPreparationFocus['priority'], string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

export default function InterviewPrepScreen() {
  // `null` means the list has not loaded yet — distinct from an empty list,
  // which is a real and meaningful state here.
  const [analyses, setAnalyses] = useState<SelectableAnalysis[] | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const result = await listPreparableAnalyses();

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

    const result = await generateInterviewPrep(analysisId, refresh);

    if ('error' in result) {
      // The route phrases its own errors for end users, including rate-limit
      // copy, so this is passed through rather than reworded.
      setError(result.error);
      setPhase({ name: 'select' });
      return;
    }

    // Reflect the new preparation in the list so the marker is right on the way
    // back, without paying for a second round-trip.
    setAnalyses(
      (previous) =>
        previous?.map((analysis) =>
          analysis.id === analysisId
            ? { ...analysis, annotation: 'Prep ready' }
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
              Pick a resume you&apos;ve already analyzed. You&apos;ll get the
              questions it invites, why each one is coming, and how to answer
              from your own material.
            </ThemedText>

            {error ? <FormError message={error} /> : null}

            {phase.name === 'results' ? (
              <Results
                result={phase.result}
                onRegenerate={() => void run(phase.analysisId, true)}
                onReset={reset}
              />
            ) : phase.name === 'generating' ? (
              <Panel title="Working out what they’ll ask…">
                <ThemedText type="small" themeColor="textSecondary">
                  This usually takes a few seconds.
                </ThemedText>
              </Panel>
            ) : (
              <AnalysisPicker
                analyses={analyses}
                onSelect={(id) => void run(id, false)}
                actionLabel="Prepare for an interview with"
                loadingTitle="Loading your resumes…"
                emptyTitle="Nothing to prepare yet"
                emptyMessage="You don't have any analyses eligible for interview preparation yet. Analyze a resume first, then come back here for the questions it invites."
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
  result: InterviewPrepResult;
  onRegenerate: () => void;
  onReset: () => void;
}) {
  const { prep } = result;

  const questions = [...prep.questions].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );
  const preparationFocus = [...prep.preparationFocus].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  return (
    <View style={styles.results}>
      <ThemedText type="small" themeColor="textSecondary">
        {result.fileName}
      </ThemedText>

      <Panel title="How you'll come across">
        <ThemedText type="small">{prep.overview}</ThemedText>
      </Panel>

      <View style={styles.section}>
        <ThemedText type="smallBold">Questions to expect</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {questions.length} questions this resume invites. Tap one to see why
          it&apos;s coming and how to answer it.
        </ThemedText>
      </View>

      {questions.map((question, index) => (
        // Index-keyed: these strings come from a model and are not guaranteed
        // distinct.
        <QuestionCard key={index} question={question} />
      ))}

      <Panel title="Talking points">
        <ThemedText type="small" themeColor="textSecondary">
          Worth raising even if nobody asks.
        </ThemedText>
        {prep.talkingPoints.map((talkingPoint, index) => (
          <View key={index} style={styles.entry}>
            <ThemedText type="small">{talkingPoint.point}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {talkingPoint.evidence}
            </ThemedText>
          </View>
        ))}
      </Panel>

      <Panel title="What to rehearse">
        {preparationFocus.map((focus, index) => (
          <View key={index} style={styles.entry}>
            <Badge label={PRIORITY_LABEL[focus.priority]} />
            <ThemedText type="small">{focus.area}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {focus.rationale}
            </ThemedText>
          </View>
        ))}
      </Panel>

      {!result.persisted ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="alert">
          This preparation couldn&apos;t be saved, so it won&apos;t be here next
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

/**
 * One collapsible question.
 *
 * The web uses a Radix `Accordion` here, deliberately: six to twelve questions
 * each carrying a rationale and guidance is far more text than any other
 * results view, and a flat list produces a page nobody reads to the bottom of.
 * This app has no accordion primitive, so the behaviour is rebuilt locally with
 * `LayoutAnimation` — React Native core, no dependency, and no `UIManager`
 * opt-in needed on iOS.
 *
 * Kept local rather than promoted to `components/ui/` because there is exactly
 * one consumer; it moves there if a second tool ever needs it, the same way
 * `Panel` and `Badge` moved once they had two.
 *
 * All items start collapsed, and each is independent — someone rehearsing wants
 * to compare answers side by side, which is why the web uses `type="multiple"`
 * rather than the FAQ's `"single"`.
 */
function QuestionCard({ question }: { question: InterviewQuestion }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((previous) => !previous);
  }

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={question.question}
      accessibilityHint={
        expanded
          ? 'Collapses why this is asked and how to answer it'
          : 'Expands why this is asked and how to answer it'
      }
      style={({ pressed }) => [
        styles.question,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={styles.questionHeader}>
        <View style={styles.questionHeaderText}>
          <Badge label={CATEGORY_LABEL[question.category]} />
          <ThemedText type="small">{question.question}</ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          {expanded ? '▾' : '▸'}
        </ThemedText>
      </View>

      {expanded ? (
        <View style={styles.questionBody}>
          <View style={styles.entry}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Why it&apos;s asked
            </ThemedText>
            <ThemedText type="small">{question.whyAsked}</ThemedText>
          </View>

          <View style={styles.entry}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              How to answer
            </ThemedText>
            <ThemedText type="small">{question.answerGuidance}</ThemedText>
          </View>
        </View>
      ) : null}
    </Pressable>
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
  section: { gap: Spacing.one },
  entry: { gap: Spacing.one, marginTop: Spacing.two },
  question: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  questionHeaderText: { flex: 1, gap: Spacing.two, alignItems: 'flex-start' },
  questionBody: { gap: Spacing.one },
  secondary: {
    alignItems: 'center',
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
