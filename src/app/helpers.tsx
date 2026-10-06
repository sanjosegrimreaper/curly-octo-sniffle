import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { SectionHeader } from '@/components/home/SectionHeader';
import { relevantAudiences, splitHelpers } from '@/components/help/audience';
import { HelperCard } from '@/components/help/HelperCard';
import { getPack } from '@/data/pack';
import { EmptyState, motion, Screen, Text, useTheme, VStack } from '@/design';
import { useProfile } from '@/hooks/useProfile';
import { useScreener } from '@/state/screener';

/** People who help for free, for the person's county; the ones that may fit them first. */
export default function HelpersScreen() {
  const { t } = useTranslation('help');
  const { reduceMotion } = useTheme();
  const profile = useProfile();
  const completedAt = useScreener((s) => s.completedAt);
  const county = useScreener((s) => s.county);

  const { forYou, others } = useMemo(
    () => splitHelpers(getPack().helpers, county, relevantAudiences(profile, completedAt !== null)),
    [county, profile, completedAt],
  );
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(Math.min(i, 8) * 40).duration(motion.slow));
  const split = completedAt !== null && others.length > 0;

  return (
    <Screen back title={t('helpers.title')} testID="helpers-screen">
      <DraftBanner />
      <Text tone="muted">{t('helpers.intro')}</Text>
      {forYou.length + others.length === 0 ? (
        <EmptyState illustration="phone" title={t('helpers.empty')} />
      ) : null}
      {forYou.length > 0 ? (
        <VStack gap="sm">
          {split ? <SectionHeader title={t('helpers.forYou')} /> : null}
          {forYou.map((h, i) => (
            <Animated.View key={h.id} entering={enter(i)}>
              <HelperCard helper={h} />
            </Animated.View>
          ))}
        </VStack>
      ) : null}
      {others.length > 0 ? (
        <VStack gap="sm">
          {split || forYou.length > 0 ? <SectionHeader title={t('helpers.others')} /> : null}
          {others.map((h, i) => (
            <Animated.View key={h.id} entering={enter(forYou.length + i)}>
              <HelperCard helper={h} />
            </Animated.View>
          ))}
        </VStack>
      ) : null}
    </Screen>
  );
}
