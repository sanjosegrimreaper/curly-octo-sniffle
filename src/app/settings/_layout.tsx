import { Stack } from 'expo-router';

import { useTheme } from '@/design';

/** Settings, Data sources & dates, About: a stack with real back gestures. */
export default function SettingsLayout() {
  const { palette, reduceMotion } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
        animation: reduceMotion ? 'fade' : 'default',
        animationDuration: reduceMotion ? 150 : undefined,
      }}
    />
  );
}
