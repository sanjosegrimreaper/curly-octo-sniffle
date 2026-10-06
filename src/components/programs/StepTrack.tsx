import { Check, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';

import { minTap, motion, Tappable, Text, useTheme } from '@/design';
import type { ApplicationStep } from '@/state/applications';

/** The five positions on the track; "approved" and "denied" share the last one (the decision). */
export const TRACK_STEPS = ['notStarted', 'gathering', 'sent', 'waiting'] as const;
export const TRACK_LENGTH = TRACK_STEPS.length + 1;

export function trackPosition(step: ApplicationStep): number {
  if (step === 'approved' || step === 'denied') return TRACK_STEPS.length;
  return TRACK_STEPS.indexOf(step);
}

/**
 * Horizontal step selector with an animated progress line:
 * Not started → Gathering documents → Sent → Waiting → Decision (Accepted / Denied).
 * The first four dots are tappable; the decision is set with the "They said yes / no" buttons.
 */
export function StepTrack({
  step,
  onChange,
  testID,
}: {
  step: ApplicationStep;
  onChange: (step: ApplicationStep) => void;
  testID?: string;
}) {
  const { t } = useTranslation('programs');
  const { palette, reduceMotion } = useTheme();
  const pos = trackPosition(step);
  const fraction = pos / (TRACK_LENGTH - 1);
  const progress = useSharedValue(reduceMotion ? fraction : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? fraction
      : withTiming(fraction, { duration: motion.slow, easing: Easing.bezier(...motion.easing) });
  }, [fraction, reduceMotion, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const lilac = palette.signals.lilac;
  const decisionSignal = step === 'approved' ? palette.signals.mint : step === 'denied' ? palette.signals.coral : null;

  return (
    <View testID={testID} style={styles.wrap} accessibilityRole="radiogroup">
      <View style={styles.lineWrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.line, { backgroundColor: palette.border }]}>
          <Animated.View style={[styles.lineFill, { backgroundColor: decisionSignal?.solid ?? lilac.solid }, fill]} />
        </View>
      </View>
      {Array.from({ length: TRACK_LENGTH }, (_, i) => {
        const isDecision = i === TRACK_LENGTH - 1;
        const label = isDecision
          ? step === 'approved' || step === 'denied'
            ? t(`steps.${step}`)
            : t('steps.decision')
          : t(`steps.${TRACK_STEPS[i] ?? 'notStarted'}`);
        const done = i < pos;
        const current = i === pos;
        const s = isDecision && decisionSignal ? decisionSignal : lilac;
        const dotStyle = done || (current && isDecision && decisionSignal)
          ? { backgroundColor: s.solid, borderColor: s.solid }
          : current
            ? { backgroundColor: s.tint, borderColor: s.solid, borderWidth: 3 }
            : { backgroundColor: palette.surface, borderColor: palette.borderStrong };
        const content =
          isDecision && current && step === 'denied' ? (
            <X size={18} color={palette.surface} strokeWidth={3} />
          ) : done || (isDecision && current && step === 'approved') ? (
            <Check size={18} color={palette.surface} strokeWidth={3} />
          ) : (
            <Text variant="label" bold style={{ color: current ? s.ink : palette.textMuted }} maxFontSizeMultiplier={1.3}>
              {String(i + 1)}
            </Text>
          );
        const dot = (
          <Animated.View
            key={`${i}-${current ? step : done ? 'done' : 'todo'}`}
            entering={reduceMotion || !current ? undefined : ZoomIn.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)}
            style={[styles.dot, dotStyle]}>
            {content}
          </Animated.View>
        );
        const a11y = t('tracker.stepA11y', { n: i + 1, step: label });
        if (isDecision) {
          return (
            <View key="decision" style={styles.slot} accessible accessibilityLabel={a11y} accessibilityState={{ selected: current }}>
              {dot}
            </View>
          );
        }
        const target = TRACK_STEPS[i] ?? 'notStarted';
        return (
          <Tappable
            key={target}
            onPress={() => onChange(target)}
            accessibilityRole="radio"
            accessibilityLabel={a11y}
            accessibilityState={{ selected: current, checked: current }}
            style={styles.slot}
            testID={testID ? `${testID}-${target}` : undefined}>
            {dot}
          </Tappable>
        );
      })}
    </View>
  );
}

const DOT = 34;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineWrap: { position: 'absolute', left: minTap / 2, right: minTap / 2, top: 0, bottom: 0, justifyContent: 'center' },
  line: { height: 6, borderRadius: 3, overflow: 'hidden' },
  lineFill: { height: '100%', borderRadius: 3 },
  slot: { width: minTap, height: minTap, alignItems: 'center', justifyContent: 'center', borderRadius: minTap / 2 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
