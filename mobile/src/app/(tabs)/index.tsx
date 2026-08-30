import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Panel } from '@/components/ui/panel';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

/**
 * Home — the mobile counterpart to the web dashboard's Overview.
 *
 * Deliberately thin. It was the Resume Analyzer until the Tools tab existed;
 * that screen now lives at `tools/resume-analyzer` with the other five, so the
 * hub can list all six honestly rather than listing five and hiding one behind
 * a different tab. Nothing of the analyzer is duplicated here.
 *
 * What this screen keeps from it is the account row: the app has no settings
 * screen, and without a sign-out control the auth flow cannot be exercised end
 * to end. Overview is where that belongs anyway — the web puts it in the
 * sidebar footer, not inside a tool.
 *
 * This tab has no stack, so it keeps its own `top` safe-area edge. Every screen
 * under `tools/` drops it, because the stack header provides that inset there.
 */
export default function HomeScreen() {
  const { session, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <ThemedText type="subtitle">Nexona</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Upload a resume, then work on it — scoring, ATS compatibility,
              rewriting, and cover letters.
            </ThemedText>

            <Panel title="Start with your resume">
              <ThemedText type="small" themeColor="textSecondary">
                Every tool works from a resume you have analyzed, so the Resume
                Analyzer is the place to begin. You will find it, and everything
                else, under Tools.
              </ThemedText>
            </Panel>

            <PrimaryButton
              label="Open Tools"
              pendingLabel=""
              pending={false}
              onPress={() => router.push('/tools')}
            />

            <View style={styles.accountRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Signed in as {session?.user.email ?? 'unknown'}
              </ThemedText>

              {/*
                Settings and Sign out sit together, mirroring the web sidebar
                footer — which also keeps them as a pair rather than listing
                Settings among the tools.
              */}
              <View style={styles.accountActions}>
                <Pressable
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Open account settings"
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="linkPrimary">Settings</ThemedText>
                </Pressable>

                <Pressable
                  onPress={signOut}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="linkPrimary">Sign out</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
  pressed: { opacity: 0.85 },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  accountRow: {
    marginTop: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    // Web's ScrollView does not stretch children the way native does.
    ...Platform.select({ web: { alignSelf: 'stretch' } }),
  },
});
