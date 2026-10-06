import { Check } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { motion, spacing, Text, useTheme, VStack } from '@/design';

/**
 * One step of the Call coach's vertical stepper: a numbered dot on a rail. When the step is
 * done, the dot turns into a mint check and the rail below fills down to the next step.
 */
export function CoachStep({
  n,
  total,
  title,
  done,
  last,
  children,
  testID,
}: {
  n: number;
  total: number;
  title: string;
  done: boolean;
  last?: boolean;
  children: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation('programs');
  const { palette, reduceMotion } = useTheme();
  const fill = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    const to = done ? 1 : 0;
    fill.value = reduceMotion
      ? to
      : withTiming(to, { duration: motion.celebrate, easing: Easing.bezier(...motion.easing) });
  }, [done, reduceMotion, fill]);

  const railFill = useAnimatedStyle(() => ({ height: `${fill.value * 100}%` }));
  const lilac = palette.signals.lilac;
  const mint = palette.signals.mint;

  return (
    <Animated.View
      testID={testID}
      entering={reduceMotion ? undefined : FadeInDown.delay(n * 60).duration(motion.slow)}
      style={styles.row}>
      <View style={styles.rail} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View
          style={[
            styles.dot,
            done
              ? { backgroundColor: mint.solid, borderColor: mint.solid }
              : { backgroundColor: lilac.tint, borderColor: lilac.solid },
          ]}>
          {done ? (
            <Animated.View
              key="done"
              entering={
                reduceMotion
                  ? undefined
                  : ZoomIn.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)
              }>
              <Check size={22} color={palette.surface} strokeWidth={3} />
            </Animated.View>
          ) : (
            <Text variant="subheading" style={{ color: lilac.ink }}>
              {String(n)}
            </Text>
          )}
        </View>
        {last ? null : (
          <View style={[styles.line, { backgroundColor: palette.border }]}>
            <Animated.View style={[styles.lineFill, { backgroundColor: mint.solid }, railFill]} />
          </View>
        )}
      </View>
      <VStack gap="sm" style={styles.body}>
        <VStack gap="xxs">
          <Text variant="caption" bold tone={done ? 'mint' : 'lilac'}>
            {done ? t('coach.stepOfDone', { n, total }) : t('coach.stepOf', { n, total })}
          </Text>
          <Text variant="heading">{title}</Text>
        </VStack>
        {children}
      </VStack>
    </Animated.View>
  );
}

const DOT = 44;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: DOT, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 4, borderRadius: 2, marginVertical: spacing.xxs, overflow: 'hidden' },
  lineFill: { width: '100%', borderRadius: 2 },
  body: { flex: 1, paddingBottom: spacing.xl, minWidth: 0 },
});
