import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The single source of truth for what the app's Tools tab contains.
 *
 * Shipping a tool is one entry here plus one screen file under
 * `app/(tabs)/tools/` — the Tools stack builds its `Stack.Screen` list from
 * `AVAILABLE_TOOLS`, and the hub renders straight off `TOOLS`, so neither has
 * to be edited again.
 *
 * `status` is a discriminated union rather than an `available: boolean`, the
 * same shape (and for the same reason) as the web's `dashboard-nav-items.ts`:
 * a `comingSoon` entry carries **no `href` and no `screen` field at all**, so
 * a route that does not exist yet cannot be navigated to or registered. A
 * planned tool is described, never faked — pointing a row at a missing screen
 * would be a runtime error, and here it is a compile error instead.
 *
 * `screen` is the file name under `tools/`, which is also its `Stack.Screen`
 * name; `href` is the full typed path the hub pushes. Both are written out
 * rather than derived so typed routes check them literally.
 */
export const TOOLS = [
  {
    id: 'resume-analyzer',
    name: 'Resume Analyzer',
    description: 'Upload a resume for an overall score, an ATS score, and specific feedback.',
    status: 'available',
    screen: 'resume-analyzer',
    href: '/tools/resume-analyzer',
  },
  {
    id: 'ats-check',
    name: 'ATS Check',
    description: 'See how a resume you have analyzed survives automated screening.',
    status: 'available',
    screen: 'ats-check',
    href: '/tools/ats-check',
  },
  {
    id: 'resume-optimizer',
    name: 'Optimizer',
    description: 'Generate an improved version of a resume you have analyzed.',
    status: 'available',
    screen: 'resume-optimizer',
    href: '/tools/resume-optimizer',
  },
  {
    id: 'cover-letter',
    name: 'Cover Letter',
    description: 'Write a letter for a specific job, grounded in your resume.',
    status: 'available',
    screen: 'cover-letter',
    href: '/tools/cover-letter',
  },
  {
    id: 'career-insights',
    name: 'Career Insights',
    description: 'Where your profile stands, the roles it supports, and what is holding it back.',
    status: 'available',
    screen: 'career-insights',
    href: '/tools/career-insights',
  },
  {
    id: 'interview-prep',
    name: 'Interview Prep',
    description: 'The questions your resume invites, and how to answer them.',
    status: 'available',
    screen: 'interview-prep',
    href: '/tools/interview-prep',
  },
] as const;

export type ToolItem = (typeof TOOLS)[number];
export type AvailableTool = Extract<ToolItem, { status: 'available' }>;

/** The tools with a real screen — what the Tools stack registers. */
export const AVAILABLE_TOOLS: readonly AvailableTool[] = TOOLS.filter(
  (tool): tool is AvailableTool => tool.status === 'available'
);

/**
 * One row per tool. Visually the analysis picker's row, deliberately — the two
 * lists sit one tap apart and should not look like different apps.
 */
export function ToolList() {
  return (
    <View style={styles.list}>
      {TOOLS.map((tool) => (
        <ToolRow key={tool.id} tool={tool} />
      ))}
    </View>
  );
}

function ToolRow({ tool }: { tool: ToolItem }) {
  const theme = useTheme();
  const available = tool.status === 'available';

  return (
    <Pressable
      onPress={available ? () => router.push(tool.href) : undefined}
      disabled={!available}
      accessibilityRole="button"
      accessibilityState={{ disabled: !available }}
      accessibilityLabel={
        available ? `Open ${tool.name}` : `${tool.name}, coming soon`
      }
      accessibilityHint={tool.description}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        !available && styles.unavailable,
        pressed && styles.pressed,
      ]}>
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{tool.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {tool.description}
        </ThemedText>
      </View>

      {available ? null : <Badge label="Soon" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.one },
  unavailable: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
