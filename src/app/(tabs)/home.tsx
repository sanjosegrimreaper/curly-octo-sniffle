import { router, type Href } from 'expo-router';
import { RotateCcw, Settings } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { priceChanges, staleLastSeen } from '@/components/home/changes';
import { ChangesCard } from '@/components/home/ChangesCard';
import { confirmAction } from '@/components/home/confirm';
import { BridgeMotif } from '@/components/home/BridgeMotif';
import { FreshnessCard } from '@/components/home/FreshnessCard';
import { greetingKey } from '@/components/home/format';
import { NavigatorBar } from '@/components/home/NavigatorBar';
import { PlanStepCard } from '@/components/home/PlanStepCard';
import { describeStep, type StepView } from '@/components/home/planSteps';
import { SavedStrip } from '@/components/home/SavedStrip';
import { SectionHeader } from '@/components/home/SectionHeader';
import { usePlanData } from '@/components/home/usePlanData';
import { getPack } from '@/data/pack';
import { Button, EmptyState, HeaderButton, motion, ReadAloud, Screen, spacing, Text, useTheme } from '@/design';
import { LANGUAGES } from '@/i18n/languages';
import { useMedicines } from '@/state/medicines';
import { wipePersonalData } from '@/state/session';
import { useUi } from '@/state/ui';

/** Stagger entrance: ~40ms apart, each ≤320ms. Nothing animates with Reduce Motion. */
function useEnter() {
  const { reduceMotion } = useTheme();
  return (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(motion.slow));
}

export default function HomeScreen() {
  const { t } = useTranslation('plan');
  const { lang, reduceMotion } = useTheme();
  const enter = useEnter();
  const { steps, saved, summaries, summariesByKey, today } = usePlanData();
  const setLastSeen = useMedicines((s) => s.setLastSeen);
  const [hour] = useState(() => new Date().getHours());

  const views = useMemo(() => {
    const ctx = { t, lang, pack: getPack(), summaries: summariesByKey, today };
    return steps.map((s) => describeStep(s, ctx)).filter((v): v is StepView => v !== null);
  }, [steps, t, lang, summariesByKey, today]);

  // "Changes since your last visit" is decided once, when the screen opens; then we
  // remember today's prices so the same change is not shown again next time.
  const [changes] = useState(() => priceChanges(saved, summaries));
  useEffect(() => {
    for (const u of staleLastSeen(saved, summaries)) setLastSeen(u.key, u.lastSeen);
  }, [saved, summaries, setLastSeen]);

  const dateText = useMemo(() => longDate(today, lang), [today, lang]);
  const intro = saved.length > 0 ? t('intro.saved', { count: saved.length }) : t('intro.fresh');

  const startOver = () =>
    confirmAction({
      title: t('startOver.title'),
      body: t('startOver.body'),
      confirmLabel: t('startOver.confirm'),
      danger: true,
      testID: 'start-over-confirm',
      onConfirm: async () => {
        await wipePersonalData();
        useUi.getState().showToast(t('startOver.done'), 'success');
        router.replace('/');
      },
    });

  let n = 0;
  return (
    <Screen inTabs testID="home-screen">
      <Animated.View entering={enter(n++)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" bold tone="accent">
            {dateText}
          </Text>
          <Text variant="display" testID="home-greeting">
            {t(`greeting.${greetingKey(hour)}`)}
          </Text>
        </View>
        <HeaderButton icon={Settings} label={t('openSettings')} onPress={() => router.push('/settings' as Href)} testID="open-settings" />
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.slow)} style={{ marginTop: -spacing.sm }}>
        <BridgeMotif />
        <Text tone="muted" style={{ marginTop: spacing.xxs }}>
          {intro}
        </Text>
      </Animated.View>

      <Animated.View entering={enter(n++)} style={{ gap: spacing.sm }}>
        <NavigatorBar />
        <DraftBanner />
      </Animated.View>

      <Animated.View entering={enter(n++)}>
        <SectionHeader
          title={t('steps.title')}
          hint={views.length > 0 ? t('steps.hint') : undefined}
          right={views.length > 0 ? <ReadAloud text={readAloudText(t('steps.title'), views)} /> : null}
        />
      </Animated.View>

      {views.length > 0 ? (
        views.map((v, i) => (
          <Animated.View key={v.key} entering={enter(n++)}>
            <PlanStepCard view={v} index={i} total={views.length} />
          </Animated.View>
        ))
      ) : (
        <Animated.View entering={enter(n++)}>
          <EmptyState
            testID="plan-empty"
            illustration="bridge"
            title={t('steps.empty.title')}
            body={t('steps.empty.body')}
            action={<Button label={t('steps.empty.cta')} variant="secondary" onPress={() => router.push('/find' as Href)} />}
          />
        </Animated.View>
      )}

      <Animated.View entering={enter(n++)}>
        <ChangesCard changes={changes} />
      </Animated.View>

      {saved.length > 0 ? (
        <Animated.View entering={enter(n++)} style={{ gap: spacing.sm }}>
          <SectionHeader
            title={t('saved.title')}
            right={
              <Button
                compact
                variant="ghost"
                label={t('saved.seeAll')}
                onPress={() => router.push('/medicines' as Href)}
                testID="plan-see-medicines"
              />
            }
          />
          <SavedStrip saved={saved} summaries={summaries} />
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(n++)} style={{ gap: spacing.sm }}>
        <SectionHeader title={t('freshness.section')} />
        <FreshnessCard />
      </Animated.View>

      <Animated.View entering={enter(n++)} style={{ marginTop: spacing.md }}>
        <Button variant="ghost" icon={RotateCcw} label={t('startOver.button')} onPress={startOver} testID="start-over" />
      </Animated.View>
    </Screen>
  );
}

function readAloudText(title: string, views: StepView[]) {
  return [title, ...views.map((v, i) => `${i + 1}. ${v.title}. ${v.price ? `${v.price.value}. ` : ''}${v.body ?? ''}`)].join(' ');
}

/** "Tuesday, October 6" in the person's language (calendar date, never shifted by time zone). */
function longDate(iso: string, lang: keyof typeof LANGUAGES) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  try {
    return new Intl.DateTimeFormat(LANGUAGES[lang].intlTag, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  } catch {
    return iso;
  }
}
