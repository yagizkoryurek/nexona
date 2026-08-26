import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import {
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
import { ListPanel, Panel, Score } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { analyzeResume, type ResumeAnalysis } from '@/lib/resume-analysis';
import { validateResumeFile } from '@/lib/resume-file';

/**
 * Resume Analyzer — the mobile counterpart to the web dashboard's tool.
 *
 * Owns the same three-phase machine the web `ResumeAnalyzer` component does
 * (`select → analyzing → results`), because the flow is genuinely the same one:
 * choose a file, wait on a single server round-trip, read the result. All of the
 * analysis happens in `/api/mobile/resume-analyzer`; this screen never sees
 * Gemini, a prompt, or the extracted text.
 */

type Phase =
  | { name: 'select' }
  | { name: 'analyzing' }
  | { name: 'results'; analysis: ResumeAnalysis; fileName: string };

/** Mirrors the web picker's `accept`, so both clients offer the same formats. */
const PICKER_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function ResumeAnalyzerScreen() {
  const { session, signOut } = useAuth();

  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [error, setError] = useState<string>();

  async function onPickAndAnalyze() {
    if (phase.name === 'analyzing') return;
    setError(undefined);

    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: PICKER_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
        // The file is uploaded as multipart, never as a base64 string. Leaving
        // this on would encode up to 10MB into memory on web for nothing.
        base64: false,
      });
    } catch {
      setError("We couldn't open the file picker. Please try again.");
      return;
    }

    // Cancelling is not an error — the user simply changed their mind.
    if (picked.canceled) return;

    const asset = picked.assets[0];
    if (!asset) return;

    const validation = validateResumeFile(asset.name, asset.size);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setPhase({ name: 'analyzing' });
    const result = await analyzeResume(asset);

    if ('error' in result) {
      // The route phrases its own errors for end users, including rate-limit
      // copy, so this is passed through rather than reworded.
      setError(result.error);
      setPhase({ name: 'select' });
      return;
    }

    setPhase({
      name: 'results',
      analysis: result.data,
      fileName: asset.name,
    });
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
            <ThemedText type="subtitle">Resume Analyzer</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Upload a PDF or Word document. You&apos;ll get an overall score, an
              ATS score, and specific feedback.
            </ThemedText>

            {error ? <FormError message={error} /> : null}

            {phase.name === 'results' ? (
              <Results
                analysis={phase.analysis}
                fileName={phase.fileName}
                onReset={reset}
              />
            ) : (
              <PrimaryButton
                label="Choose a resume"
                pendingLabel="Analyzing…"
                pending={phase.name === 'analyzing'}
                onPress={onPickAndAnalyze}
              />
            )}

            {phase.name === 'analyzing' ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.centered}>
                This usually takes a few seconds.
              </ThemedText>
            ) : null}

            {/*
              Signed-in state and the way out of it. Kept from the scaffold
              screen this replaced — without a sign-out control the auth flow
              cannot be exercised end to end, and there is no account screen yet.
            */}
            <View style={styles.accountRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Signed in as {session?.user.email ?? 'unknown'}
              </ThemedText>
              <Pressable
                onPress={signOut}
                disabled={phase.name === 'analyzing'}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText type="linkPrimary">Sign out</ThemedText>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Results({
  analysis,
  fileName,
  onReset,
}: {
  analysis: ResumeAnalysis;
  fileName: string;
  onReset: () => void;
}) {
  return (
    <View style={styles.results}>
      <ThemedText type="small" themeColor="textSecondary">
        {fileName}
      </ThemedText>

      <View style={styles.scoreRow}>
        <Score label="Overall" value={analysis.overallScore} />
        <Score label="ATS" value={analysis.atsScore} />
      </View>

      <Panel title="Summary">
        <ThemedText type="small">{analysis.summary}</ThemedText>
      </Panel>

      {/*
        These three are `.min(1)` in the server's schema, so the empty copy
        below should never appear — `emptyMessage` is required on ListPanel for
        the tools whose lists genuinely can be empty.
      */}
      <ListPanel
        title="Strengths"
        items={analysis.strengths}
        emptyMessage="None identified."
      />
      <ListPanel
        title="Weaknesses"
        items={analysis.weaknesses}
        emptyMessage="None identified."
      />
      <ListPanel
        title="Suggestions"
        items={analysis.suggestions}
        emptyMessage="None identified."
      />

      <PrimaryButton
        label="Analyze another resume"
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
  centered: { textAlign: 'center' },
  pressed: { opacity: 0.85 },
  results: { gap: Spacing.three },
  scoreRow: { flexDirection: 'row', gap: Spacing.three },
  accountRow: {
    marginTop: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
