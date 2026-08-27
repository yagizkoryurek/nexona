import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ToolList } from '@/components/ui/tool-list';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * The Tools hub — every tool in one list, one tap from anywhere.
 *
 * This exists so the tab bar does not have to grow a tab per tool. It holds no
 * state and knows nothing about any individual tool: the list, the copy, and
 * which tools are shipped all live in `tool-list.tsx`.
 *
 * No `top` safe-area edge — the stack header owns that inset, same as every
 * tool screen beneath it.
 */
export default function ToolsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <ThemedText themeColor="textSecondary">
              Everything Nexona can do with your resume.
            </ThemedText>

            <ToolList />
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
});
