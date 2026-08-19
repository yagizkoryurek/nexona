import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { analyzeResume, type ResumeAnalysis } from '@/lib/resume-analysis';
import { formatFileSize, validateResumeFile } from '@/lib/resume-file';

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

      <ListPanel title="Strengths" items={analysis.strengths} />
      <ListPanel title="Weaknesses" items={analysis.weaknesses} />
      <ListPanel title="Suggestions" items={analysis.suggestions} />

      <PrimaryButton
        label="Analyze another resume"
        pendingLabel=""
        pending={false}
        onPress={onReset}
      />
    </View>
  );
}

/**
 * The web renders these as a `ScoreRing` (an inline SVG). This is a plain
 * numeric readout instead — the app has no SVG dependency, and adding one to
 * draw two circles is not worth it before the rest of the toolkit exists.
 */
function Score({ label, value }: { label: string; value: number }) {
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
    </View>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel title={title}>
      {items.map((item) => (
        <View key={item} style={styles.listItem}>
          <ThemedText type="small" themeColor="textSecondary">
            {'•'}
          </ThemedText>
          <ThemedText type="small" style={styles.listItemText}>
            {item}
          </ThemedText>
        </View>
      ))}
    </Panel>
  );
}

/** Same treatment as `AuthButton`, which is not exported for reuse outside the auth screens. */
function PrimaryButton({
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
  results: { gap: Spacing.three },
  scoreRow: { flexDirection: 'row', gap: Spacing.three },
  score: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  panel: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  listItem: { flexDirection: 'row', gap: Spacing.two },
  listItemText: { flex: 1 },
  accountRow: {
    marginTop: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
