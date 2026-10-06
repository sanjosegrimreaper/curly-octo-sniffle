import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { motion, useTheme } from '@/design';

const APath = Animated.createAnimatedComponent(Path);
const ALine = Animated.createAnimatedComponent(Line);
const ACircle = Animated.createAnimatedComponent(Circle);
const ARect = Animated.createAnimatedComponent(Rect);

// Geometry (viewBox 0 0 320 112). The arc is a quadratic curve whose control point sits
// halfway between its ends, so x is linear in t and a hanger's height is easy to compute.
const DECK_Y = 88;
const X0 = 28;
const X1 = 292;
const PEAK_CTRL_Y = 8;
const ARC = `M${X0} ${DECK_Y} Q${(X0 + X1) / 2} ${PEAK_CTRL_Y} ${X1} ${DECK_Y}`;
const HANGERS = [64, 100, 136, 160, 184, 220, 256];

function arcY(x: number): number {
  const t = (x - X0) / (X1 - X0);
  return (1 - t) * (1 - t) * DECK_Y + 2 * (1 - t) * t * PEAK_CTRL_Y + t * t * DECK_Y;
}

/** Arc length, sampled once (pure). */
const ARC_LENGTH = (() => {
  let len = 0;
  let px = X0;
  let py = DECK_Y;
  for (let i = 1; i <= 64; i++) {
    const x = X0 + ((X1 - X0) * i) / 64;
    const y = arcY(x);
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return Math.ceil(len) + 2;
})();

const ease = Easing.bezier(...motion.easing);

/**
 * The home header's bridge: the arc draws itself, the hangers rise, the sun comes up and a
 * small pill settles on the deck. Plays once (nothing loops). With Reduce Motion it is drawn
 * in its final state. Decorative only.
 */
export function BridgeMotif({ height = 96 }: { height?: number }) {
  const { palette, reduceMotion, highContrast } = useTheme();
  const arc = useSharedValue(reduceMotion ? 1 : 0);
  const rise = useSharedValue(reduceMotion ? 1 : 0);
  const sun = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      arc.value = 1;
      rise.value = 1;
      sun.value = 1;
      return;
    }
    arc.value = withTiming(1, { duration: motion.celebrate, easing: ease });
    rise.value = withDelay(motion.base, withTiming(1, { duration: motion.celebrate, easing: ease }));
    sun.value = withDelay(motion.slow, withTiming(1, { duration: motion.slow, easing: ease }));
  }, [reduceMotion, arc, rise, sun]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - arc.value) }));
  const sunProps = useAnimatedProps(() => ({
    cy: interpolate(sun.value, [0, 1], [58, 26]),
    opacity: sun.value,
  }));
  const pillProps = useAnimatedProps(() => ({
    x: interpolate(rise.value, [0, 1], [X0, 146]),
    opacity: rise.value,
  }));

  const s = palette.signals;
  const deck = highContrast ? palette.text : palette.accentInk;

  return (
    <View aria-hidden style={{ width: '100%', height }}>
      <Svg width="100%" height="100%" viewBox="0 0 320 112" preserveAspectRatio="xMidYMid meet">
        {!highContrast ? <Rect x="8" y="96" width="304" height="12" rx="6" fill={s.sky.tint} /> : null}
        <ACircle cx="262" r="13" fill={s.sunflower.fill} animatedProps={sunProps} />
        {HANGERS.map((x, i) => (
          <Hanger key={x} x={x} index={i} progress={rise} color={palette.accent} />
        ))}
        <APath
          d={ARC}
          stroke={palette.accent}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
          animatedProps={arcProps}
        />
        <Line x1="14" y1={DECK_Y} x2="306" y2={DECK_Y} stroke={deck} strokeWidth={5} strokeLinecap="round" />
        <Rect x="18" y={DECK_Y} width="8" height="14" rx="2" fill={deck} />
        <Rect x="294" y={DECK_Y} width="8" height="14" rx="2" fill={deck} />
        <ARect y={DECK_Y - 13} width="28" height="11" rx="5.5" fill={s.mint.fill} animatedProps={pillProps} />
      </Svg>
    </View>
  );
}

function Hanger({ x, index, progress, color }: { x: number; index: number; progress: SharedValue<number>; color: string }) {
  const top = arcY(x);
  const props = useAnimatedProps(() => {
    // Staggered: each hanger starts a little after the one before it.
    const local = Math.min(1, Math.max(0, progress.value * (HANGERS.length + 2) - index) / 3);
    return { y2: DECK_Y - (DECK_Y - top) * local };
  });
  return <ALine x1={x} y1={DECK_Y} x2={x} stroke={color} strokeWidth={3} strokeLinecap="round" animatedProps={props} />;
}
