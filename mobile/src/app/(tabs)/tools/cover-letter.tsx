import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthField, FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnalysisPicker } from '@/components/ui/analysis-picker';
import { Panel } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { listOptimizableAnalyses, type SelectableAnalysis } from '@/lib/analyses';
import { hasErrors, type FieldErrors } from '@/lib/auth-validation';
import {
  generateCoverLetter,
  type CoverLetterJob,
  type CoverLetterResult,
} from '@/lib/cover-letter';
import {
  validateCoverLetterJob,
  type CoverLetterField,
} from '@/lib/cover-letter-validation';

/**
 * Cover Letter Generator — the mobile counterpart to the web dashboard's tool.
 *
 * One phase more than every other mobile tool (`select → details → generating
 * → results`), because a cover letter needs a job described, not just an
 * analysis selected. That extra phase is the whole structural difference; the
 * web component has exactly the same four.
 *
 * There is no "already generated" branch and no cache, and that is deliberate
 * rather than an omission: a letter is keyed to a job, not just a resume, so
 * there is no single existing letter an analysis converges on. Every
 * generation is a new row and spends a rate-limit slot.
 *
 * As on the web, this screen never sees a prompt, the extracted resume text, or
 * Gemini. All of that happens in `/api/mobile/cover-letter`.
 */

type Phase =
  | { name: 'select' }
  | { name: 'details' }
  | { name: 'generating' }
  | { name: 'results'; result: CoverLetterResult };

/** The form's own values, before trimming and before blanks are dropped. */
type JobFormValues = {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
};

const EMPTY_JOB: JobFormValues = {
  jobTitle: '',
  companyName: '',
  jobDescription: '',
};

export default function CoverLetterScreen() {
  // `null` means the list has not loaded yet — distinct from an empty list,
  // which is a real and meaningful state here.
  const [analyses, setAnalyses] = useState<SelectableAnalysis[] | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Held by the screen rather than by the form so the entered job survives a
  // failed generation and prefills "Generate another".
  const [job, setJob] = useState<JobFormValues>(EMPTY_JOB);
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<CoverLetterField>
  >({});
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    // The same eligibility rule as the Optimizer's picker — a stored
    // `resume_text` — and deliberately no annotation: a letter is keyed to a
    // job, not a resume, so "already has one" would not mean anything here.
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
  // user part-way through a job form is not yanked back to the picker.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function onSelect(analysisId: string) {
    setError(undefined);
    setSelectedId(analysisId);
    setPhase({ name: 'details' });
  }

  async function onGenerate() {
    // Guards against a second tap while one generation is in flight. There is
    // no stored letter to serve, so a duplicate submission spends a second
    // usage slot outright.
    if (phase.name === 'generating' || !selectedId) return;

    const errors = validateCoverLetterJob(job);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setError(undefined);
    setPhase({ name: 'generating' });

    // Trimmed to match what the route's schema validates, and a blank company
    // omitted entirely rather than sent as "" — the column then stores null and
    // the prompt addresses the letter generically.
    const companyName = job.companyName.trim();
    const payload: CoverLetterJob = {
      jobTitle: job.jobTitle.trim(),
      jobDescription: job.jobDescription.trim(),
      ...(companyName.length > 0 ? { companyName } : {}),
    };

    const result = await generateCoverLetter(selectedId, payload);

    if ('error' in result) {
      // Back to `details`, never to `select`. The job description may be
      // thousands of pasted characters; discarding it because a quota check
      // failed would be the worst thing this screen could do. The route phrases
      // its own errors for end users, including rate-limit copy, so this is
      // passed through rather than reworded.
      setError(result.error);
      setPhase({ name: 'details' });
      return;
    }

    setPhase({ name: 'results', result: result.data });
  }

  /** Same resume, same job details — for writing a second variant. */
  function generateAnother() {
    setError(undefined);
    setPhase({ name: 'details' });
  }

  /** Full reset, back to the picker. */
  function chooseDifferentResume() {
    setError(undefined);
    setFieldErrors({});
    setSelectedId(null);
    setJob(EMPTY_JOB);
    setPhase({ name: 'select' });
  }

  const showingForm = phase.name === 'details' || phase.name === 'generating';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {/*
          The first tool screen with a text input, so the first that needs this.
          Same treatment as `AuthScreen` in components/auth/auth-form.tsx.
        */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <ThemedText themeColor="textSecondary">
                Pick a resume you&apos;ve already analyzed, tell us about the
                job, and we&apos;ll write a letter grounded in that resume.
              </ThemedText>

              {error ? <FormError message={error} /> : null}

              {phase.name === 'results' ? (
                <Results
                  result={phase.result}
                  onGenerateAnother={generateAnother}
                  onChooseDifferentResume={chooseDifferentResume}
                />
              ) : showingForm ? (
                <JobForm
                  values={job}
                  errors={fieldErrors}
                  pending={phase.name === 'generating'}
                  onChange={setJob}
                  onSubmit={() => void onGenerate()}
                  onChooseDifferentResume={chooseDifferentResume}
                />
              ) : (
                <AnalysisPicker
                  analyses={analyses}
                  onSelect={onSelect}
                  actionLabel="Write a cover letter for"
                  loadingTitle="Loading your resumes…"
                  emptyTitle="Nothing to write about yet"
                  emptyMessage="You don't have any analyses eligible for a cover letter yet. Analyze a resume on the Home tab first, then come back here to write one."
                />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * The job this letter is for.
 *
 * Local to this screen rather than a shared component, the same call both
 * projects have already made: the web's `CoverLetterJobForm` is kept inline
 * because there is no second consumer, and the mobile ATS Check keeps its own
 * result panels local for the same reason.
 *
 * Values live in the screen, not here, so a failed generation can return to
 * this form with everything still typed. The form stays mounted while
 * `generating` — disabled rather than replaced by a loading panel — which is
 * both what the web does and what keeps the entered text on screen.
 */
function JobForm({
  values,
  errors,
  pending,
  onChange,
  onSubmit,
  onChooseDifferentResume,
}: {
  values: JobFormValues;
  errors: FieldErrors<CoverLetterField>;
  pending: boolean;
  onChange: (values: JobFormValues) => void;
  onSubmit: () => void;
  onChooseDifferentResume: () => void;
}) {
  return (
    <View style={styles.form}>
      <Panel title="About the job">
        <AuthField
          label="Job title"
          value={values.jobTitle}
          onChangeText={(jobTitle) => onChange({ ...values, jobTitle })}
          error={errors.jobTitle}
          editable={!pending}
          placeholder="Senior Frontend Engineer"
          autoCapitalize="words"
          returnKeyType="next"
        />

        <AuthField
          label="Company name (optional)"
          value={values.companyName}
          onChangeText={(companyName) => onChange({ ...values, companyName })}
          error={errors.companyName}
          editable={!pending}
          placeholder="Acme Inc."
          autoCapitalize="words"
          returnKeyType="next"
        />

        <AuthField
          label="Job description"
          value={values.jobDescription}
          onChangeText={(jobDescription) =>
            onChange({ ...values, jobDescription })
          }
          error={errors.jobDescription}
          editable={!pending}
          placeholder="Paste the job posting…"
          multiline
          // Without this the text centres vertically on Android and starts in
          // the middle of the box.
          textAlignVertical="top"
          style={styles.multiline}
        />
      </Panel>

      <PrimaryButton
        label="Generate cover letter"
        pendingLabel="Generating…"
        pending={pending}
        onPress={onSubmit}
      />

      <Pressable
        onPress={onChooseDifferentResume}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel="Choose a different resume"
        accessibilityState={{ disabled: pending }}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <ThemedText type="linkPrimary" style={pending && styles.disabled}>
          Choose a different resume
        </ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * A completed letter.
 *
 * Plain text, not markdown: the model is prompted to format for readability
 * with its own line breaks and greeting/closing, and this app has no markdown
 * renderer to justify adding for a single field — the same call the Optimizer's
 * results view makes. `selectable` for the same reason it has it: nothing here
 * is exported, so hand-selecting is the only way the text leaves the app.
 */
function Results({
  result,
  onGenerateAnother,
  onChooseDifferentResume,
}: {
  result: CoverLetterResult;
  onGenerateAnother: () => void;
  onChooseDifferentResume: () => void;
}) {
  return (
    <View style={styles.results}>
      <ThemedText type="small" themeColor="textSecondary">
        {result.companyName
          ? `${result.jobTitle} · ${result.companyName}`
          : result.jobTitle}
      </ThemedText>

      <Panel title="Cover Letter">
        <ThemedText type="small" selectable>
          {result.letter}
        </ThemedText>
      </Panel>

      {!result.persisted ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          accessibilityRole="alert">
          This letter couldn&apos;t be saved, so it won&apos;t be here next
          time.
        </ThemedText>
      ) : null}

      <PrimaryButton
        label="Generate another"
        pendingLabel=""
        pending={false}
        onPress={onGenerateAnother}
      />
      <Pressable
        onPress={onChooseDifferentResume}
        accessibilityRole="button"
        accessibilityLabel="Choose a different resume"
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
        <ThemedText type="linkPrimary">Choose a different resume</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
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
  form: { gap: Spacing.three },
  multiline: { minHeight: 160 },
  results: { gap: Spacing.three },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  secondary: {
    alignItems: 'center',
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
