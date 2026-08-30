import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AuthField, AuthLink, FormError } from '@/components/auth/auth-form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { deleteAccount } from '@/lib/account';

/**
 * The Danger Zone's control: a two-step, type-to-confirm account deletion.
 *
 * Confirmation is inline rather than a native `Alert`, matching the web card and
 * for the same reason it chose inline over a modal — a phrase the user has to
 * type is a stronger gate than a button they can tap twice, and expanding in
 * place keeps the consequences on screen while they decide.
 *
 * Note this component never names the account to delete. `deleteAccount()` takes
 * no arguments and the SQL function derives the user from `auth.uid()`, so there
 * is deliberately no user id anywhere in this file to tamper with.
 *
 * There is no success branch. A successful deletion signs the user out, which
 * flips the root layout's guard and unmounts this screen — so the only outcome
 * this component renders is a failure.
 */

/**
 * Typed verbatim to arm the delete button. Uppercase and matched exactly, so it
 * cannot be satisfied by an accidental keystroke.
 */
const CONFIRMATION_PHRASE = 'DELETE';

/** Shared with `auth-form.tsx`'s error styling — the app's one destructive red. */
const DESTRUCTIVE = '#dc2626';

export function DeleteAccountCard() {
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const armed = phrase.trim() === CONFIRMATION_PHRASE;

  function onCancel() {
    setConfirming(false);
    setPhrase('');
    setError(undefined);
  }

  async function onDelete() {
    if (!armed || pending) return;

    setError(undefined);
    setPending(true);

    const result = await deleteAccount();

    if (result.error) {
      // The phrase is kept on purpose: a failed attempt should not make the
      // user retype the confirmation to try again.
      setPending(false);
      setError(result.error);
      return;
    }

    // Leave `pending` set — the guard is about to unmount this screen.
  }

  if (!confirming) {
    return (
      <View style={styles.card}>
        {error ? <FormError message={error} /> : null}

        <DestructiveButton
          label="Delete Account"
          pendingLabel="Delete Account"
          pending={false}
          onPress={() => setConfirming(true)}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.warning}>
        <ThemedText type="small" style={styles.warningText}>
          This permanently deletes your Nexona account and everything in it —
          your resume analyses, ATS audits, cover letters, career insights and
          interview preparation. This cannot be undone, and we cannot recover
          any of it for you afterwards.
        </ThemedText>
      </View>

      {error ? <FormError message={error} /> : null}

      <AuthField
        label={`Type ${CONFIRMATION_PHRASE} to confirm`}
        value={phrase}
        onChangeText={setPhrase}
        placeholder={CONFIRMATION_PHRASE}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        editable={!pending}
        onSubmitEditing={onDelete}
        returnKeyType="go"
      />

      <ThemedText type="small" themeColor="textSecondary">
        Enter it exactly, in capitals.
      </ThemedText>

      <DestructiveButton
        label="Permanently delete account"
        pendingLabel="Deleting…"
        pending={pending}
        disabled={!armed}
        onPress={onDelete}
      />

      <AuthLink label="Cancel" disabled={pending} onPress={onCancel} />
    </View>
  );
}

/**
 * `PrimaryButton` in the app's destructive colour.
 *
 * Kept local rather than added to `components/ui/`: it is `PrimaryButton` with
 * one colour changed and a `disabled` prop, and the Danger Zone is its only
 * consumer. If a second one appears, the two should merge there instead.
 */
function DestructiveButton({
  label,
  pendingLabel,
  pending,
  disabled,
  onPress,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const inactive = pending || Boolean(disabled);

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: pending }}
      accessibilityLabel={pending ? pendingLabel : label}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        inactive && styles.buttonDisabled,
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
  card: { gap: Spacing.two },
  warning: {
    borderWidth: 1,
    borderColor: DESTRUCTIVE,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 10,
    padding: Spacing.three,
  },
  warningText: { color: DESTRUCTIVE },
  button: {
    backgroundColor: DESTRUCTIVE,
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
});
