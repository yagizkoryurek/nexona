import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ChangePasswordCard } from '@/components/settings/change-password-card';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Panel } from '@/components/ui/panel';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { webBaseUrl } from '@/lib/env';

/**
 * Account Settings — the mobile counterpart to the web's `/dashboard/settings`.
 *
 * A root-level route rather than one under `(tabs)`: `AppTabs` is `NativeTabs`,
 * which expects a trigger per route in its group, so a settings file there would
 * mean adding a third tab or a hidden trigger. At the root it pushes over the
 * tab bar with a native header and back button — the same feel as a tool screen
 * — and `app/_layout.tsx` registers it *inside* the existing `Stack.Protected`
 * so it is guarded exactly like `(tabs)` is.
 *
 * Every field here is read-only. Editing the email or the name would need auth
 * behaviour neither client has, so the web does not offer it either.
 *
 * The stack header supplies the top inset and the title, so this screen drops
 * the `top` safe-area edge and renders no heading of its own — the same rule
 * every screen under `tools/` follows. Re-adding either double-counts it.
 */
export default function SettingsScreen() {
  const { session } = useAuth();
  const theme = useTheme();

  const user = session?.user;
  const email = user?.email;
  const name = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const emailConfirmed = Boolean(user?.email_confirmed_at);

  // Pinned to `en-US` rather than left to the device locale. The web pins it for
  // a different reason — it renders server-side, where `undefined` would resolve
  // to the *server's* locale rather than the reader's — and that reason does not
  // carry over here. It is kept anyway so an account reads the same on both
  // clients, in an app whose copy is English throughout.
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <ThemedText type="small" themeColor="textSecondary">
                Your account details, security, and privacy in one place.
              </ThemedText>

              <Panel title="Account information">
                <ThemedText type="small" themeColor="textSecondary">
                  The details attached to your Nexona account.
                </ThemedText>

                <InfoRow label="Email" value={email ?? 'Unavailable'}>
                  <ThemedText
                    type="small"
                    themeColor={emailConfirmed ? 'textSecondary' : undefined}
                    style={emailConfirmed ? undefined : styles.unverified}>
                    {emailConfirmed ? 'Verified' : 'Not yet verified'}
                  </ThemedText>
                </InfoRow>

                <InfoRow label="Name" value={name || 'Not set'} />

                {memberSince ? (
                  <InfoRow label="Member since" value={memberSince} />
                ) : null}
              </Panel>

              <Panel title="Security">
                <ThemedText type="small" themeColor="textSecondary">
                  We&apos;ll email you a code to choose a new password. Setting
                  it signs you out, so you&apos;ll sign back in with the new one.
                </ThemedText>

                {email ? (
                  <ChangePasswordCard email={email} />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    We couldn&apos;t read the email address on this account, so a
                    code can&apos;t be sent right now. Try signing out and back
                    in.
                  </ThemedText>
                )}
              </Panel>

              <Panel title="Privacy and legal">
                <ThemedText type="small" themeColor="textSecondary">
                  How Nexona handles your resume data, and the terms you agreed
                  to.
                </ThemedText>

                <View style={styles.legalLinks}>
                  <ExternalLink href={`${webBaseUrl}/privacy`}>
                    <ThemedText type="linkPrimary">Privacy Policy</ThemedText>
                  </ExternalLink>

                  <ExternalLink href={`${webBaseUrl}/terms`}>
                    <ThemedText type="linkPrimary">Terms of Service</ThemedText>
                  </ExternalLink>
                </View>
              </Panel>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.backgroundSelected },
                ]}
              />

              <Panel title="Danger Zone">
                <ThemedText type="small" themeColor="textSecondary">
                  Deleting your account is permanent. It removes your resume
                  analyses, ATS audits, cover letters, career insights, and
                  interview preparation, and none of it can be recovered.
                </ThemedText>

                <DeleteAccountCard />
              </Panel>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * One label/value pair in the account-information list. `children` carries the
 * optional second line — currently only the email's verification state.
 */
function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.infoValue}>
        {value}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  infoRow: { gap: Spacing.half },
  // Long addresses must wrap rather than push the panel wide.
  infoValue: { flexShrink: 1 },
  unverified: { color: '#dc2626' },
  legalLinks: { gap: Spacing.one, alignItems: 'flex-start' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
});
