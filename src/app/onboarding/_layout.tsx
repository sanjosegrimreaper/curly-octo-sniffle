import { Stack } from 'expo-router';

import { useTheme } from '@/design';

/** The screener stack: real back gestures and hardware back; crossfades with Reduce Motion (same as the root stack). */
export default function OnboardingLayout() {
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
