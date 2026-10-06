import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { motion, radius, spacing, Text, useTheme } from '@/design';

/** At most this many glyphs are drawn; larger households show "+N". */
export const MAX_DRAWN = 8;

/** How many glyphs to draw and how many go in the "+N" pill. */
export function peopleRowParts(count: number): { drawn: number; extra: number } {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return { drawn: Math.min(n, MAX_DRAWN), extra: Math.max(0, n - MAX_DRAWN) };
}

/**
 * The household "People row": one person glyph per member that pops in and out with a spring
 * as the count changes. Purely decorative — hidden from screen readers (the stepper announces the count).
 */
export function PeopleRow({ count }: { count: number }) {
  const { palette, reduceMotion } = useTheme();
  const { drawn, extra } = peopleRowParts(count);
  const s = palette.signals;
  const colors = [palette.accent, s.lilac.fill, s.sky.fill, s.mint.fill, s.tangerine.fill, s.sunflower.fill, s.coral.fill, s.sky.solid];

  return (
    <View
      style={styles.row}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="people-row">
      {Array.from({ length: drawn }, (_, i) => (
        <Animated.View
          key={i}
          testID="person-glyph"
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(12).stiffness(220)}
          exiting={reduceMotion ? undefined : ZoomOut.duration(motion.fast)}
          layout={reduceMotion ? undefined : LinearTransition.springify().damping(motion.spring.damping)}>
          <Person color={colors[i % colors.length] ?? palette.accent} head={palette.surface} />
        </Animated.View>
      ))}
      {extra > 0 ? (
        <Animated.View
          key="extra"
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
          exiting={reduceMotion ? undefined : ZoomOut.duration(motion.fast)}
          style={[styles.extra, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}>
          <Text variant="label" bold tone="accent" tabular>
            {`+${extra}`}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Person({ color, head }: { color: string; head: string }) {
  return (
    <Svg width={30} height={44} viewBox="0 0 30 44">
      <Circle cx={15} cy={10} r={8} fill={color} />
      <Circle cx={12.5} cy={8.5} r={2.2} fill={head} opacity={0.35} />
      <Path d="M3 42 V33 a12 12 0 0 1 24 0 V42 Z" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 6,
    minHeight: 52,
    paddingVertical: spacing.xxs,
  },
  extra: {
    minWidth: 44,
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
