import AppTabs from '@/components/app-tabs';

/**
 * The signed-in area. Grouped so the root layout can gate the whole tab bar
 * behind a session with a single `Stack.Protected`, rather than each screen
 * checking for itself.
 *
 * `AppTabs` is unchanged from the scaffold — the tab screens moved into this
 * group, their contents did not.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
