import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, radius, useTheme, type SignalName } from '@/design';

/** Small animated progress bar (documents ready, steps done). Always paired with text by callers. */
export function ProgressBar({
  value,
  signal = 'lilac',
  height = 10,
  accessibilityLabel,
  testID,
}: {
  /** 0..1 */
  value: number;
  signal?: SignalName;
  height?: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { palette, reduceMotion } = useTheme();
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  const progress = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? clamped
      : withTiming(clamped, { duration: motion.slow, easing: Easing.bezier(...motion.easing) });
  }, [clamped, reduceMotion, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const done = clamped >= 1;
  const color = done ? palette.signals.mint.solid : palette.signals[signal].solid;

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: radius.pill, borderWidth: 1, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
