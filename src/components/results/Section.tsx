import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { motion, spacing, Text, typeScale, useTheme, type SignalName } from '@/design';

/** Section heading with a signal-tinted icon: icon + words, never color alone. */
export function SectionHeading({
  icon: Icon,
  signal,
  title,
  subtitle,
  right,
}: {
  icon: LucideIcon;
  signal: SignalName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { palette } = useTheme();
  const s = palette.signals[signal];
  return (
    <View style={styles.heading}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: s.tint, borderColor: s.solid }]}>
          <Icon size={20} color={s.ink} />
        </View>
        <Text variant="heading" style={styles.title}>
          {title}
        </Text>
        {right}
      </View>
      {subtitle ? (
        <Text variant="label" tone="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Staggered entrance for a block of the results page (≈60 ms apart). Final state with Reduce Motion. */
export function Reveal({ index, children, testID }: { index: number; children: ReactNode; testID?: string }) {
  const { reduceMotion } = useTheme();
  return (
    <Animated.View
      testID={testID}
      entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 10) * 60).duration(motion.slow)}
      style={styles.reveal}>
      {children}
    </Animated.View>
  );
}

/** A bullet line ("•" is decorative and hidden from screen readers). */
export function Bullet({ children, tone }: { children: string; tone?: 'muted' | 'default' }) {
  const { palette, textScale, fonts } = useTheme();
  // Centre the dot on the first line of label text at any text size.
  const line = typeScale.label.size * typeScale.label.line * textScale * fonts.lineHeightBoost;
  return (
    <View style={styles.bullet}>
      <View
        style={[styles.dot, { backgroundColor: palette.textMuted, marginTop: line / 2 - 3 }]}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <Text variant="label" tone={tone === 'muted' ? 'muted' : 'default'} style={styles.bulletText}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xxs, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  reveal: { gap: spacing.md },
  bullet: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  bulletText: { flex: 1 },
});
