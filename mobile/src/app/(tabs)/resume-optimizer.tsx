import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnalysisPicker } from '@/components/ui/analysis-picker';
import { Panel } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  listOptimizableAnalyses,
  type SelectableAnalysis,
} from '@/lib/analyses';
import { optimizeResume } from '@/lib/resume-optimization';

/**
 * Resume Optimizer — the mobile counterpart to the web dashboard's tool.
 *
 * Structurally this is the ATS Check's sibling: it opens on a list rather than
 * a file picker, because it acts on an analysis the user already has. Three
 * things make it the simpler of the two, and all three are deliberate on the
 * web side rather than omissions here:
 *
 * - **No score.** The tool rewrites a resume; it does not grade one.
 * - **No stored result, so no cache and no "refresh".** The optimized resume is
 *   returned and then forgotten — there is no table behind it. Every run is a
 *   fresh generation and spends a rate-limit slot.
 * - **No export.** The text is rendered selectable so it can be lifted out by
 *   hand; adding a clipboard or share path is a dependency decision the web
 *   tool has not made either.
 *
 * As on the web, this screen never sees a prompt, the extracted resume text, or
 * Gemini. All of that happens in `/api/mobile/resume-optimizer`.
 */

type Phase =
  | { name: 'select' }
  | { name: 'optimizing' }
  | { name: 'results'; fileName: string; optimizedResume: string };

export default function ResumeOptimizerScreen() {
  // `null` means the list has not loaded yet — distinct from an empty list,
  // which is a real and meaningful state here.
  const [analyses, setAnalyses] = useState<SelectableAnalysis[] | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    const result = await listOptimizableAnalyses();

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

  async function runOptimization(analysis: SelectableAnalysis) {
    // Guards against a second tap while one generation is in flight. That
    // matters more here than on the cached tools: there is no stored result to
    // serve, so a duplicate submission spends a second usage slot outright.
    if (phase.name === 'optimizing') return;

    setError(undefined);
    setPhase({ name: 'optimizing' });

    const result = await optimizeResume(analysis.id);

    if ('error' in result) {
      // The route phrases its own errors for end users, including rate-limit
      // copy, so this is passed through rather than reworded.
      setError(result.error);
      setPhase({ name: 'select' });
      return;
    }

    // The route returns no file name — it is carried from the picked row
    // instead, so the result can still say which resume it rewrote.
    setPhase({
      name: 'results',
      fileName: analysis.fileName,
      optimizedResume: result.data.optimizedResume,
    });
  }

  function onSelect(analysisId: string) {
    const analysis = analyses?.find((candidate) => candidate.id === analysisId);
    if (!analysis) return;

    void runOptimization(analysis);
  }

  function reset() {
    setError(undefined);
    setPhase({ name: 'select' });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <ThemedText type="subtitle">Optimizer</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Pick a resume you&apos;ve already analyzed. We&apos;ll generate an
              improved version of it.
            </ThemedText>

            {error ? <FormError message={error} /> : null}

            {phase.name === 'results' ? (
              <Results
                fileName={phase.fileName}
                optimizedResume={phase.optimizedResume}
                onReset={reset}
              />
            ) : phase.name === 'optimizing' ? (
              <Panel title="Generating your optimized resume…">
                <ThemedText type="small" themeColor="textSecondary">
                  This usually takes a few seconds.
                </ThemedText>
              </Panel>
            ) : (
              <AnalysisPicker
                analyses={analyses}
                onSelect={onSelect}
                actionLabel="Optimize"
                loadingTitle="Loading your resumes…"
                emptyTitle="Nothing to optimize yet"
                emptyMessage="You don't have any analyses eligible for optimization yet. Analyze a resume on the Home tab first, then come back here to generate an improved version of it."
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * The completed rewrite.
 *
 * Plain text, not markdown: the model is prompted to format for readability
 * with its own line breaks and headers, and this app has no markdown renderer
 * to justify adding for a single field — the same call the web results
 * component makes.
 *
 * `selectable` is doing real work rather than being a nicety. Nothing here is
 * stored and there is no export path, so hand-selecting the text is the only
 * way a user gets it out of the app at all.
 */
function Results({
  fileName,
  optimizedResume,
  onReset,
}: {
  fileName: string;
  optimizedResume: string;
  onReset: () => void;
}) {
  return (
    <View style={styles.results}>
      <ThemedText type="small" themeColor="textSecondary">
        {fileName}
      </ThemedText>

      <Panel title="Optimized Resume">
        <ThemedText type="small" selectable>
          {optimizedResume}
        </ThemedText>
      </Panel>

      <PrimaryButton
        label="Try another resume"
        pendingLabel=""
        pending={false}
        onPress={onReset}
      />
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
  subtitle: { marginTop: -Spacing.two },
  results: { gap: Spacing.three },
});
