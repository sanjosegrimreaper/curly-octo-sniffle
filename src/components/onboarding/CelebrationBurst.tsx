import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motion, useTheme } from '@/design';

const PARTICLES = 12;

/**
 * A one-shot radial burst of confetti dots around its center (≤ 600 ms, never loops).
 * Renders nothing with Reduce Motion. Decorative — hidden from screen readers.
 */
export function CelebrationBurst({ size = 160, delay = 0 }: { size?: number; delay?: number }) {
  const { palette, reduceMotion } = useTheme();
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    p.value = withDelay(delay, withTiming(1, { duration: motion.celebrate, easing: Easing.out(Easing.cubic) }));
  }, [reduceMotion, delay, p]);

  if (reduceMotion) return null;
  const s = palette.signals;
  const colors = [s.sunflower.fill, s.mint.fill, s.lilac.fill, s.sky.fill, s.tangerine.fill, s.coral.fill];

  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.wrap, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]}>
      {Array.from({ length: PARTICLES }, (_, i) => (
        <Particle
          key={i}
          progress={p}
          angle={(i / PARTICLES) * Math.PI * 2 + (i % 2 ? 0.18 : 0)}
          distance={(size / 2) * (i % 3 === 0 ? 0.95 : i % 3 === 1 ? 0.78 : 0.62)}
          color={colors[i % colors.length] ?? palette.accent}
          dot={i % 2 === 0 ? 8 : 6}
          center={size / 2}
        />
      ))}
    </View>
  );
}

function Particle({
  progress,
  angle,
  distance,
  color,
  dot,
  center,
}: {
  progress: SharedValue<number>;
  angle: number;
  distance: number;
  color: string;
  dot: number;
  center: number;
}) {
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const style = useAnimatedStyle(() => {
    const v = progress.value;
    return {
      opacity: v === 0 ? 0 : v < 0.7 ? 1 : 1 - (v - 0.7) / 0.3,
      transform: [{ translateX: dx * v }, { translateY: dy * v }, { scale: 0.4 + 0.8 * Math.sin(v * Math.PI) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: center - dot / 2,
          top: center - dot / 2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({ wrap: { position: 'absolute', left: '50%', top: '50%' } });
