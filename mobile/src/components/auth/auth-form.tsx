import { forwardRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared building blocks for the auth screens.
 *
 * Built inline here rather than as a general design system: these are the only
 * five forms in the app so far, and the web app's own convention (see
 * CoverLetterJobForm) is to keep a form local until a second consumer justifies
 * generalising it.
 */

/** Screen shell: keyboard handling, scrolling, heading, and a form-level error. */
export function AuthScreen({
  title,
  subtitle,
  error,
  children,
}: {
  title: string;
  subtitle: string;
  error?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.subtitle}
            // Announced together with the title so a screen reader reaching
            // this screen hears what it is for, not just its name.
            accessibilityRole="text">
            {subtitle}
          </ThemedText>

          {error ? <FormError message={error} /> : null}

          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Form-level error (a rejected sign-in, an expired code). `role="alert"` so it
 * is announced when it appears rather than only on focus.
 */
export function FormError({ message }: { message: string }) {
  return (
    <View style={styles.formError} accessibilityRole="alert">
      <ThemedText type="small" style={styles.formErrorText}>
        {message}
      </ThemedText>
    </View>
  );
}

export type AuthFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

/** Labelled input with its error wired up for assistive tech. */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(
  function AuthField({ label, error, style, ...rest }, ref) {
    const theme = useTheme();

    return (
      <View style={styles.field}>
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundElement,
              color: theme.text,
              borderColor: error ? '#dc2626' : theme.backgroundSelected,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel={label}
          // Ties the message to the input so it is read out with the field.
          accessibilityHint={error}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error ? (
          <ThemedText type="small" style={styles.fieldError}>
            {error}
          </ThemedText>
        ) : null}
      </View>
    );
  }
);

/** Primary action. Disabled and spinner-labelled while a request is in flight. */
export function AuthButton({
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
        pressed && styles.buttonPressed,
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

/** Secondary, text-only action (navigate to sign-up, resend a code, go back). */
export function AuthLink({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={styles.linkRow}>
      <ThemedText type="linkPrimary" style={disabled && styles.linkDisabled}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Checkbox for the terms gate, mirroring the web sign-up form's requirement. */
export function AuthCheckbox({
  label,
  checked,
  onToggle,
  error,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  error?: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={styles.checkboxRow}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: error ? '#dc2626' : theme.backgroundSelected,
              backgroundColor: checked ? '#3c87f7' : theme.backgroundElement,
            },
          ]}>
          {checked ? (
            <ThemedText type="smallBold" style={styles.checkboxMark}>
              ✓
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="small" style={styles.checkboxLabel}>
          {label}
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" style={styles.fieldError}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  subtitle: { marginTop: -Spacing.two },
  field: { gap: Spacing.one },
  label: { marginBottom: Spacing.half },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  fieldError: { color: '#dc2626' },
  formError: {
    borderWidth: 1,
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 10,
    padding: Spacing.three,
  },
  formErrorText: { color: '#dc2626' },
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonBusy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  buttonText: { color: '#ffffff' },
  linkRow: { alignItems: 'center', paddingVertical: Spacing.one },
  linkDisabled: { opacity: 0.5 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: { color: '#ffffff' },
  checkboxLabel: { flex: 1 },
});
