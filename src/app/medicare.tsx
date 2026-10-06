import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { SectionHeader } from '@/components/home/SectionHeader';
import { servesCounty } from '@/components/help/audience';
import { FactCard } from '@/components/help/FactCard';
import { HelperCard } from '@/components/help/HelperCard';
import { getPack } from '@/data/pack';
import { Button, motion, Screen, Text, useTheme, VStack } from '@/design';
import { useScreener } from '@/state/screener';

/** Medicare panel: verified facts (Part D cap, Extra Help, payment plan, HICAP) + free Medicare helpers. */
export default function MedicareScreen() {
  const { t } = useTranslation('help');
  const { reduceMotion } = useTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const county = useScreener((s) => s.county);
  const fromOnboarding = from === 'onboarding';

  const { facts, helpers } = useMemo(() => {
    const pack = getPack();
    return {
      facts: pack.facts.filter((f) => f.id.startsWith('medicare-') || f.id === 'hicap'),
      helpers: pack.helpers.filter((h) => h.forWhom === 'medicare' && servesCounty(h, county)),
    };
  }, [county]);

  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(motion.slow));

  const lookUp = () => {
    const s = useScreener.getState();
    if (!s.completedAt) s.update({ completedAt: new Date().toISOString() });
    router.replace('/find' as Href);
  };

  return (
    <Screen
      back
      title={t('medicare.title')}
      testID="medicare-screen"
      footer={
        fromOnboarding ? <Button icon={Search} label={t('medicare.lookUp')} onPress={lookUp} testID="medicare-look-up" /> : undefined
      }>
      <DraftBanner />
      <Text tone="muted">{t('medicare.intro')}</Text>

      <SectionHeader title={t('medicare.factsTitle')} />
      <VStack gap="sm">
        {facts.map((f, i) => (
          <Animated.View key={f.id} entering={enter(i)}>
            <FactCard fact={f} />
          </Animated.View>
        ))}
      </VStack>

      <SectionHeader title={t('medicare.helpersTitle')} hint={t('medicare.helpersHint')} />
      {helpers.length > 0 ? (
        <VStack gap="sm">
          {helpers.map((h, i) => (
            <Animated.View key={h.id} entering={enter(facts.length + i)}>
              <HelperCard helper={h} />
            </Animated.View>
          ))}
        </VStack>
      ) : (
        <Text tone="muted">{t('medicare.noHelpers')}</Text>
      )}
    </Screen>
  );
}
