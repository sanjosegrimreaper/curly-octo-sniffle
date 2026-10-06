import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, motion, radius, spacing } from '../tokens';
import { Tappable } from './Tappable';

export type SegmentOption<T extends string> = { value: T; label: string; testID?: string };

/** Two-to-four option switch with a sliding indicator. Used for Prices | Help paying and Monthly | Yearly. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { palette, reduceMotion } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const x = useSharedValue(0);
  const segment = width / options.length;

  useEffect(() => {
    x.value = reduceMotion ? index * segment : withSpring(index * segment, motion.spring);
  }, [index, segment, reduceMotion, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 8)}
      style={[styles.track, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
      {width > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            { width: segment, backgroundColor: palette.surface, borderColor: palette.accent },
            indicator,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Tappable
            key={o.value}
            testID={o.testID}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={styles.option}>
            <Text variant="label" bold={selected} center style={{ color: selected ? palette.accentInk : palette.textMuted }}>
              {o.label}
            </Text>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, borderWidth: 1, padding: 4 },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.pill, borderWidth: 2 },
  option: { flex: 1, minHeight: minTap, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
});
