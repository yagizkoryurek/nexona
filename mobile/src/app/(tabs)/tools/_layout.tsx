import { Stack } from 'expo-router';

import { AVAILABLE_TOOLS } from '@/components/ui/tool-list';

/**
 * The Tools tab's own navigation stack.
 *
 * A stack nested *inside* a tab rather than wrapping the tabs: this keeps the
 * tab bar visible over a pushed tool, keeps `Stack.Protected` in
 * `app/_layout.tsx` attached to the `(tabs)` group where it already is, and
 * gives every tool a native back button and the iOS swipe-back gesture — none
 * of which the previous flat tab bar had.
 *
 * Re-tapping the Tools tab pops back to the hub. That is `NativeTabs`'
 * `disablePopToTop` default (`false`), not something implemented here.
 *
 * Titles come from `AVAILABLE_TOOLS`, so shipping a tool means adding one entry
 * in `tool-list.tsx` and one screen file — this layout needs no edit. A
 * `comingSoon` entry carries no `screen` field, so it cannot be registered here
 * until its route actually exists.
 */
export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="index" options={{ title: 'Tools' }} />

      {AVAILABLE_TOOLS.map((tool) => (
        <Stack.Screen
          key={tool.id}
          name={tool.screen}
          options={{ title: tool.name }}
        />
      ))}
    </Stack>
  );
}
