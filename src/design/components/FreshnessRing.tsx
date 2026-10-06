import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { freshness, todayISO } from '@/domain';

import { useTheme } from '../theme';
import { motion } from '../tokens';

const ACircle = Animated.createAnimatedComponent(Circle);

/** A ring that drains as data ages toward 6 months: mint → sunflower → coral. Always paired with text by callers. */
export function FreshnessRing({ verifiedAsOf, size = 28, today }: { verifiedAsOf: string; size?: number; today?: string }) {
  const { palette, reduceMotion } = useTheme();
  const f = freshness(verifiedAsOf, today ?? todayISO());
  const remaining = 1 - f.fraction;
  const color =
    f.level === 'fresh' ? palette.signals.mint.solid : f.level === 'aging' ? palette.signals.sunflower.solid : palette.signals.coral.solid;
  const stroke = Math.max(3, size / 8);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useSharedValue(reduceMotion ? remaining : 0);

  useEffect(() => {
    progress.value = reduceMotion ? remaining : withTiming(remaining, { duration: motion.celebrate });
  }, [remaining, reduceMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));

  return (
    <View aria-hidden>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={palette.border} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
