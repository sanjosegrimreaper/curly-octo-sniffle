import { Check, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { motion, radius, spacing, Tappable, Text, useTheme, type SignalName } from '@/design';

export type ChoiceCardProps = {
  title: string;
  subtitle?: string;
  /** Icon in a tinted circle. Use `leading` for custom art instead. */
  icon?: LucideIcon;
  leading?: ReactNode;
  /** Tint for the icon circle; defaults to the accent. */
  signal?: SignalName;
  selected: boolean;
  onPress: () => void;
  /** Position in its group, for the ~40 ms entrance stagger. */
  index?: number;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * A big single-choice card (radio semantics): icon, title, optional subtitle and a radio dot
 * that fills with a check when selected. Selection is shown by the check and the border, not color alone.
 */
export function ChoiceCard({
  title,
  subtitle,
  icon: Icon,
  leading,
  signal,
  selected,
  onPress,
  index = 0,
  accessibilityHint,
  testID,
}: ChoiceCardProps) {
  const { palette, reduceMotion } = useTheme();
  const tint = signal ? palette.signals[signal].tint : palette.accentSoft;
  const ink = signal ? palette.signals[signal].ink : palette.accentInk;

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeInDown.delay(index * 40)
              .duration(motion.slow)
              .easing(Easing.bezier(...motion.easing))
      }>
      <Tappable
        testID={testID}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, selected }}
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        accessibilityHint={accessibilityHint}
        style={[
          styles.card,
          {
            backgroundColor: selected ? palette.accentSoft : palette.surface,
            borderColor: selected ? palette.accent : palette.border,
            shadowColor: palette.shadow,
          },
        ]}>
        {Icon ? (
          <View style={[styles.icon, { backgroundColor: selected ? palette.surface : tint }]}>
            <Icon size={26} color={ink} />
          </View>
        ) : (
          leading
        )}
        <View style={styles.text}>
          <Text variant="subheading" style={selected ? { color: palette.accentInk } : undefined}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="label" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        <RadioDot selected={selected} />
      </Tappable>
    </Animated.View>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  const { palette, reduceMotion } = useTheme();
  return (
    <View
      style={[
        styles.radio,
        { borderColor: selected ? palette.accent : palette.borderStrong, backgroundColor: palette.surface },
      ]}>
      {selected ? (
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.springify().damping(motion.spring.damping).stiffness(260)}
          style={[styles.radioFill, { backgroundColor: palette.accent }]}>
          <Check size={18} color={palette.onAccent} strokeWidth={3} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Wraps a set of ChoiceCards as one radio group for screen readers. */
export function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  icon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  radio: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
