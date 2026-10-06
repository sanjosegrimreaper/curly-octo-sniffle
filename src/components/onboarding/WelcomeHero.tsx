import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { motion, useTheme } from '@/design';

const APath = Animated.createAnimatedComponent(Path);
const AG = Animated.createAnimatedComponent(G);

// viewBox units
const VB_W = 260;
const VB_H = 168;
const DECK_Y = 124;
const ARC = `M30 ${DECK_Y} Q130 6 230 ${DECK_Y}`;
const ARC_LENGTH = 242;
const HANGERS = [52, 74, 186, 208];
/** Arch height at x (quadratic with a centered control point). */
const arcY = (x: number) => {
  const t = (x - 30) / 200;
  return (1 - t) * (1 - t) * DECK_Y + 2 * (1 - t) * t * 6 + t * t * DECK_Y;
};

// The capsule pill under the arch.
const PILL = { x: 92, y: 88, w: 76, h: 34 };

/**
 * The welcome hero: RxBridge's bridge-over-a-pill motif. The arch draws in, the pill springs up
 * onto the deck and the sun warms in (≤ 600 ms total). Reduce Motion shows the final picture.
 * Decorative — hidden from screen readers.
 */
export function WelcomeHero({ width = 260 }: { width?: number }) {
  const { palette, reduceMotion, scheme } = useTheme();
  const s = palette.signals;
  const scale = width / VB_W;
  const height = VB_H * scale;

  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const pill = useSharedValue(reduceMotion ? 1 : 0);
  const sun = useSharedValue(reduceMotion ? 1 : 0);
  const glow = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      pill.value = 1;
      sun.value = 1;
      glow.value = 1;
      return;
    }
    const ease = Easing.bezier(...motion.easing);
    glow.value = withTiming(1, { duration: motion.slow, easing: ease });
    draw.value = withDelay(60, withTiming(1, { duration: 420, easing: ease }));
    pill.value = withDelay(180, withSpring(1, { damping: 11, stiffness: 170, mass: 0.9 }));
    sun.value = withDelay(300, withTiming(1, { duration: motion.slow, easing: ease }));
  }, [reduceMotion, draw, pill, sun, glow]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - draw.value) }));
  const hangerProps = useAnimatedProps(() => ({ opacity: Math.max(0, (draw.value - 0.6) / 0.4) }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pill.value * 2),
    transform: [{ translateY: (1 - pill.value) * 34 * scale }, { scale: 0.7 + 0.3 * pill.value }],
  }));
  const sunStyle = useAnimatedStyle(() => ({
    opacity: sun.value,
    transform: [{ scale: 0.6 + 0.4 * sun.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.85 + 0.15 * glow.value }],
  }));

  const sunSize = 34 * scale;
  const glowSize = 160 * scale;

  return (
    <View
      style={{ width, height, alignSelf: 'center' }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      testID="welcome-hero">
      {/* soft glow behind everything */}
      <Animated.View
        style={[
          styles.abs,
          {
            left: (width - glowSize) / 2,
            top: (height - glowSize) / 2 - 2 * scale,
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: palette.accentSoft,
            opacity: scheme === 'dark' ? 0.9 : 1,
          },
          glowStyle,
        ]}
      />
      {/* sun */}
      <Animated.View
        style={[styles.abs, { left: 200 * scale, top: 6 * scale, width: sunSize, height: sunSize }, sunStyle]}>
        <Svg width={sunSize} height={sunSize} viewBox="0 0 34 34">
          <Circle cx={17} cy={17} r={12} fill={s.sunflower.fill} />
          <Circle cx={13} cy={13} r={4} fill="#FFFFFF" opacity={0.35} />
        </Svg>
      </Animated.View>
      {/* water, piers, deck */}
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={styles.abs}>
        <Path
          d={`M6 ${VB_H - 18} q 13 -6 26 0 t 26 0 t 26 0 t 26 0 t 26 0 t 26 0 t 26 0 t 26 0 t 26 0 t 26 0`}
          stroke={s.sky.fill}
          strokeOpacity={0.6}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M40 ${VB_H - 6} q 12 -5 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0`}
          stroke={s.sky.fill}
          strokeOpacity={0.35}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Rect x={24} y={DECK_Y} width={14} height={30} rx={4} fill={palette.borderStrong} />
        <Rect x={222} y={DECK_Y} width={14} height={30} rx={4} fill={palette.borderStrong} />
        <Line x1={14} y1={DECK_Y} x2={246} y2={DECK_Y} stroke={palette.text} strokeWidth={8} strokeLinecap="round" />
      </Svg>
      {/* the pill springs onto the deck */}
      <Animated.View
        style={[
          styles.abs,
          { left: PILL.x * scale, top: PILL.y * scale, width: PILL.w * scale, height: PILL.h * scale },
          pillStyle,
        ]}>
        <Svg width={PILL.w * scale} height={PILL.h * scale} viewBox={`0 0 ${PILL.w} ${PILL.h}`}>
          <Rect
            x={1.5}
            y={1.5}
            width={PILL.w - 3}
            height={PILL.h - 3}
            rx={(PILL.h - 3) / 2}
            fill={palette.surface}
            stroke={palette.accent}
            strokeWidth={3}
          />
          <Path
            d={`M${PILL.w / 2} 1.5 H${(PILL.h - 3) / 2 + 1.5} a${(PILL.h - 3) / 2} ${(PILL.h - 3) / 2} 0 0 0 0 ${PILL.h - 3} H${PILL.w / 2} Z`}
            fill={palette.accent}
          />
          <Rect x={10} y={8} width={16} height={5} rx={2.5} fill="#FFFFFF" opacity={0.45} />
        </Svg>
      </Animated.View>
      {/* the arch draws across, then its hangers appear */}
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={styles.abs}>
        <AG animatedProps={hangerProps}>
          {HANGERS.map((x) => (
            <Line
              key={x}
              x1={x}
              y1={arcY(x) + 3}
              x2={x}
              y2={DECK_Y - 4}
              stroke={palette.accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
        </AG>
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
    </View>
  );
}

const styles = StyleSheet.create({ abs: { position: 'absolute', left: 0, top: 0 } });
