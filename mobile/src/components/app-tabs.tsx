import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The app's bottom navigation: Home and Tools, and deliberately nothing else.
 *
 * There was a tab per tool until there were four of them and six coming. A
 * six-tab bar collapses into iOS's "More" list, so the tools moved behind a
 * single Tools tab backed by a stack (`app/(tabs)/tools/_layout.tsx`). Shipping
 * a tool now adds a row to the hub, not a tab here — this file should not need
 * to change again.
 *
 * SF Symbols rather than bundled PNGs, matching the tabs this replaces. `sf` is
 * iOS-only, so Android shows labels alone until drawables are added.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tools">
        <NativeTabs.Trigger.Label>Tools</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
