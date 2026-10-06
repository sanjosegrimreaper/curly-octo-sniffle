import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Path } from 'react-native-svg';

import { motion, useTheme } from '@/design';

const APath = Animated.createAnimatedComponent(Path);
const ARC = 'M20 92 Q100 0 180 92';
const ARC_LENGTH = 220;

/** The bridge arc draws in, then the app rises underneath (≤700 ms). Skipped with Reduce Motion. */
export function AnimatedSplash() {
  const { palette, reduceMotion } = useTheme();
  const [done, setDone] = useState(reduceMotion);
  const draw = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    const ease = Easing.bezier(...motion.easing);
    draw.value = withTiming(1, { duration: 380, easing: ease });
    fade.value = withDelay(
      400,
      withTiming(0, { duration: 260, easing: ease }, (finished) => {
        if (finished) scheduleOnRN(setDone, true);
      }),
    );
  }, [reduceMotion, draw, fade]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - draw.value) }));
  const overlay = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (done) return null;
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: palette.bg }, overlay]}>
      <Svg width={200} height={110} viewBox="0 0 200 110">
        <Path d="M10 92 H190" stroke={palette.text} strokeWidth={8} strokeLinecap="round" />
        <APath
          d={ARC}
          stroke={palette.accent}
          strokeWidth={10}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
          animatedProps={arcProps}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
