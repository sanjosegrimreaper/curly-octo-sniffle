import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { motion, Text, useTheme, type TextTone, type TypeVariant } from '@/design';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const ROLL_MS = 420;
const STAGGER_MS = 35;

export type OdometerProps = {
  /** The formatted value, e.g. "$1,035" (from formatMoney). Digits roll; other characters stay put. */
  text: string;
  variant?: TypeVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  /** Screen readers hear this instead of the digit strips (defaults to `text`). */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Odometer price: tabular digits roll into place when the value first appears and
 * whenever it changes (e.g. a new strength or amount). With Reduce Motion it renders
 * the final value immediately as plain text.
 */
export function Odometer({ text, variant = 'price', tone, style, accessibilityLabel, testID }: OdometerProps) {
  const { reduceMotion } = useTheme();
  if (reduceMotion) {
    return (
      <Text testID={testID} variant={variant} tone={tone} tabular style={style} accessibilityLabel={accessibilityLabel}>
        {text}
      </Text>
    );
  }
  const chars = Array.from(text);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
      style={styles.row}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {chars.map((ch, i) => {
          // Keyed from the right so ones stay ones when "$345" becomes "$1,035".
          const fromRight = chars.length - i;
          const digit = Number(ch);
          return /\d/.test(ch) ? (
            <DigitColumn
              key={`d${fromRight}`}
              digit={digit}
              delay={(chars.length - 1 - i) * STAGGER_MS}
              variant={variant}
              tone={tone}
              style={style}
            />
          ) : (
            <Text key={`c${fromRight}${ch}`} variant={variant} tone={tone} tabular style={style}>
              {ch}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function DigitColumn({
  digit,
  delay,
  variant,
  tone,
  style,
}: {
  digit: number;
  delay: number;
  variant: TypeVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}) {
  const [height, setHeight] = useState(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!height) return;
    y.value = withDelay(
      delay,
      withTiming(-digit * height, { duration: ROLL_MS, easing: Easing.bezier(...motion.easing) }),
    );
  }, [digit, height, delay, y]);

  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.column} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {/* Sizes the column; tabular figures make every digit the same width. */}
      <Text variant={variant} tone={tone} tabular style={[style, styles.ghost]}>
        {digit}
      </Text>
      <Animated.View style={[styles.strip, strip]}>
        {DIGITS.map((d) => (
          <Text key={d} variant={variant} tone={tone} tabular style={style}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'nowrap' },
  column: { overflow: 'hidden' },
  ghost: { opacity: 0 },
  strip: { position: 'absolute', top: 0, left: 0, right: 0 },
});
