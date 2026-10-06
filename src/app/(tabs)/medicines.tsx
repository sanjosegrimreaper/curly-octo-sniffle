import { router, type Href } from 'expo-router';
import { Lock, Search } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { BudgetCard } from '@/components/home/BudgetCard';
import { budgetView } from '@/components/home/budgetView';
import { MedicineCard } from '@/components/home/MedicineCard';
import { NavigatorBar } from '@/components/home/NavigatorBar';
import { Banner, Button, EmptyState, motion, Screen, spacing, Text, useTheme } from '@/design';
import { usePriceSummaries } from '@/hooks/usePrices';
import { useMedicines } from '@/state/medicines';
import { useSettings } from '@/state/settings';

/**
 * My medicines. The saved list is short and personal (a handful of entries), so it renders
 * as a plain list inside the screen's scroll view rather than a nested virtualized list.
 */
export default function MedicinesScreen() {
  const { t } = useTranslation('medicines');
  const { reduceMotion } = useTheme();
  const saved = useMedicines((s) => s.saved);
  const summaries = usePriceSummaries(saved);
  const appLock = useSettings((s) => s.appLock);
  const navigatorMode = useSettings((s) => s.navigatorMode);
  const view = useMemo(() => budgetView(saved, summaries), [saved, summaries]);

  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(motion.slow));
  const layout = reduceMotion ? undefined : LinearTransition.duration(motion.base);

  return (
    <Screen inTabs title={t('title')} testID="medicines-screen">
      <NavigatorBar />
      <DraftBanner />
      {saved.length === 0 ? (
        <Animated.View entering={enter(0)}>
          <EmptyState
            testID="medicines-empty"
            illustration="pillBottle"
            title={t('empty.title')}
            body={t('empty.body')}
            action={
              <Button icon={Search} label={t('empty.cta')} onPress={() => router.push('/find' as Href)} testID="medicines-find" />
            }
          />
        </Animated.View>
      ) : (
        <>
          <Text tone="muted">{t('intro')}</Text>
          <Animated.View entering={enter(0)} layout={layout}>
            <BudgetCard view={view} />
          </Animated.View>
          {!appLock && !navigatorMode && Platform.OS !== 'web' ? (
            <Animated.View entering={enter(1)} layout={layout}>
              <Banner icon={Lock} title={t('lock.title')} body={t('lock.body')} testID="medicines-lock-hint">
                <Button
                  compact
                  variant="secondary"
                  label={t('lock.cta')}
                  onPress={() => router.push('/settings' as Href)}
                  style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
                />
              </Banner>
            </Animated.View>
          ) : null}
          {saved.map((m, i) => (
            <Animated.View key={m.key} entering={enter(i + 2)} layout={layout}>
              <MedicineCard medicine={m} summary={summaries[i] ?? null} />
            </Animated.View>
          ))}
        </>
      )}
    </Screen>
  );
}
