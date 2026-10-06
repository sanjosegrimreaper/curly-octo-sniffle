import { router, type Href } from 'expo-router';
import { HeartHandshake, Stethoscope } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { SectionHeader } from '@/components/home/SectionHeader';
import { ClinicCard } from '@/components/help/ClinicCard';
import { getPack } from '@/data/pack';
import type { Clinic } from '@/data/schemas';
import { Banner, Button, EmptyState, motion, Screen, Text, useTheme, VStack } from '@/design';
import { useScreener } from '@/state/screener';

/** Community clinics: the person's county when we know it, otherwise everything grouped by county. */
export default function ClinicsScreen() {
  const { t } = useTranslation('help');
  const { reduceMotion } = useTheme();
  const county = useScreener((s) => s.county);
  const pack = getPack();
  const regionCounty = pack.region.counties.find((c) => c.id === county) ?? null;
  const [showAll, setShowAll] = useState(regionCounty === null);

  const groups = useMemo(() => {
    const list = showAll || !regionCounty ? pack.clinics : pack.clinics.filter((c) => c.county === regionCounty.id);
    const byCounty = new Map<string, Clinic[]>();
    for (const c of list) byCounty.set(c.county, [...(byCounty.get(c.county) ?? []), c]);
    // Region order first, then anything else.
    const order = pack.region.counties.map((c) => c.id);
    return [...byCounty.entries()]
      .sort(([a], [b]) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)))
      .map(([id, clinics]) => ({
        id,
        name: pack.region.counties.find((c) => c.id === id)?.name ?? t('clinics.unknownCounty'),
        clinics,
      }));
  }, [showAll, regionCounty, pack, t]);

  const total = groups.reduce((n, g) => n + g.clinics.length, 0);
  const summary =
    !showAll && regionCounty
      ? t('clinics.countShown', { count: total, county: regionCounty.name })
      : t('clinics.countAll', { count: total });

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(summary);
  }, [summary]);

  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(Math.min(i, 8) * 40).duration(motion.slow));
  let i = 0;

  return (
    <Screen back title={t('clinics.title')} testID="clinics-screen">
      <DraftBanner />
      <Banner icon={Stethoscope} title={t('clinics.note')} testID="clinics-note" />

      {total === 0 && regionCounty ? (
        <EmptyState
          testID="clinics-empty"
          illustration="mapPin"
          title={t('clinics.emptyTitle', { county: regionCounty.name })}
          body={t('clinics.emptyBody')}
          action={
            <VStack gap="xs">
              <Button label={t('clinics.showAll')} onPress={() => setShowAll(true)} testID="clinics-show-all" />
              <Button
                variant="secondary"
                icon={HeartHandshake}
                label={t('clinics.helpers')}
                onPress={() => router.push('/helpers' as Href)}
              />
            </VStack>
          }
        />
      ) : (
        <>
          <Text variant="label" bold tone="muted" accessibilityLiveRegion="polite">
            {summary}
          </Text>
          {regionCounty ? (
            <Button
              compact
              variant="ghost"
              label={showAll ? t('clinics.showMine', { county: regionCounty.name }) : t('clinics.showAll')}
              onPress={() => setShowAll((v) => !v)}
              style={{ alignSelf: 'flex-start' }}
              testID="clinics-toggle"
            />
          ) : null}
          {groups.map((g) => (
            <VStack key={g.id} gap="sm">
              {groups.length > 1 || showAll ? <SectionHeader title={g.name} /> : null}
              {g.clinics.map((c) => (
                <Animated.View key={c.id} entering={enter(i++)}>
                  <ClinicCard clinic={c} />
                </Animated.View>
              ))}
            </VStack>
          ))}
        </>
      )}
    </Screen>
  );
}
