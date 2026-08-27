import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

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
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ats-check">
        <NativeTabs.Trigger.Label>ATS Check</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/*
        An SF Symbol rather than a bundled PNG like its two siblings: there is
        no third icon asset, and this needs no binary file. The tradeoff is that
        `sf` is iOS-only — on Android this trigger shows its label with no icon
        until a `drawable` is added alongside it.
      */}
      <NativeTabs.Trigger name="resume-optimizer">
        <NativeTabs.Trigger.Label>Optimizer</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="wand.and.stars" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
