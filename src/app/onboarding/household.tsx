import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AmountField } from '@/components/onboarding/AmountField';
import { HouseholdStepper, parseLargeHousehold, STEPPER_MAX } from '@/components/onboarding/HouseholdStepper';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { Button, GlossaryChip, motion, spacing, useTheme } from '@/design';
import { useScreener } from '@/state/screener';

const ROUTE = ROUTES.household;

/**
 * Household size: big stepper with the People row (1 to "8 or more"). At 8 or more the exact
 * number is required, prefilled with 8.
 */
export default function HouseholdScreen() {
  const { t } = useTranslation('onboarding');
  const { reduceMotion } = useTheme();
  const stored = useScreener((s) => s.householdSize);
  const update = useScreener((s) => s.update);
  const size = stored ?? 1;
  const large = size >= STEPPER_MAX;
  const [typed, setTyped] = useState(large ? String(size) : String(STEPPER_MAX));
  const typedValue = parseLargeHousehold(typed);
  const typedInvalid = large && typedValue === null;
  const canContinue = !large || typedValue !== null;

  const onStepper = (n: number) => {
    update({ householdSize: n });
    if (n >= STEPPER_MAX) setTyped(String(n));
  };

  const onTyped = (text: string) => {
    setTyped(text);
    const n = parseLargeHousehold(text);
    if (n !== null) update({ householdSize: n });
  };

  const next = () => {
    if (!canContinue) return;
    update({ householdSize: large && typedValue !== null ? typedValue : size });
    router.push(href(ROUTES.income));
  };

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-household"
      title={t('household.title')}
      subtitle={t('household.body')}
      footer={<Button label={t('next')} onPress={next} disabled={!canContinue} testID="household-next" />}>
      <HouseholdStepper value={size} onChange={onStepper} />

      {large ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
          <AmountField
            label={t('household.typeLabel')}
            value={typed}
            onChangeText={onTyped}
            decimal={false}
            placeholder={String(STEPPER_MAX)}
            error={typedInvalid ? t('household.typeInvalid') : null}
            testID="household-typed"
          />
        </Animated.View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <GlossaryChip termId="household" label={t('household.whoCounts')} />
      </View>
    </ScreenerScreen>
  );
}
