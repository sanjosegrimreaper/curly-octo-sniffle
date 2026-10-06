import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { motion, radius, spacing, Tappable, Text, useTheme } from '@/design';

import { PeopleRow } from './PeopleRow';

export const STEPPER_MIN = 1;
/** The buttons go up to 8 ("8 or more"); then the exact number (8–20) is required. */
export const STEPPER_MAX = 8;
export const TYPED_MAX = 20;

/** The exact size typed for "8 or more" (8..20), else null. */
export function parseLargeHousehold(text: string): number | null {
  const s = text.trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= STEPPER_MAX && n <= TYPED_MAX ? n : null;
}

/** Big household stepper with the People row. Screen readers get one adjustable control ("3 people"). */
export function HouseholdStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { palette, reduceMotion } = useTheme();
  const { t } = useTranslation('onboarding');
  const valueText = t('household.people', { count: value });

  const set = (n: number) => {
    if (n === value) return;
    onChange(n);
    AccessibilityInfo.announceForAccessibility(t('household.people', { count: n }));
  };
  const canDec = value > STEPPER_MIN;
  const canInc = value < STEPPER_MAX;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow },
      ]}>
      <PeopleRow count={value} />
      <View
        style={styles.row}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('household.stepperLabel')}
        accessibilityValue={{ min: STEPPER_MIN, max: Math.max(STEPPER_MAX, value), now: value, text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && canInc) set(value + 1);
          if (e.nativeEvent.actionName === 'decrement' && canDec) set(value - 1);
        }}>
        <StepButton
          icon={Minus}
          label={t('household.fewer')}
          disabled={!canDec}
          onPress={() => set(value - 1)}
          testID="household-minus"
        />
        <View style={styles.value}>
          <Animated.View key={value} entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
            <Text variant="price" center tabular testID="household-count">
              {value}
            </Text>
          </Animated.View>
          <Text variant="label" tone="muted" center>
            {t('household.unit', { count: value })}
          </Text>
        </View>
        <StepButton
          icon={Plus}
          label={t('household.more')}
          disabled={!canInc}
          onPress={() => set(value + 1)}
          testID="household-plus"
        />
      </View>
    </View>
  );
}

function StepButton({
  icon: Icon,
  label,
  disabled,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { palette } = useTheme();
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[
        styles.stepBtn,
        {
          backgroundColor: disabled ? palette.surfaceSunken : palette.accent,
          borderColor: disabled ? palette.border : palette.accent,
        },
      ]}>
      <Icon size={30} color={disabled ? palette.textMuted : palette.onAccent} strokeWidth={2.75} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  value: { flex: 1, alignItems: 'center' },
  stepBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
