import { router, type Href } from 'expo-router';
import { BookOpen, FolderOpen, HeartHandshake, Landmark, ShieldCheck, Stethoscope } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { NavigatorBar } from '@/components/home/NavigatorBar';
import { SectionHeader } from '@/components/home/SectionHeader';
import { NoticeCard } from '@/components/help/NoticeCard';
import { getPack } from '@/data/pack';
import { todayISO } from '@/domain';
import { ListRow, motion, Screen, Text, useTheme, VStack, type SignalName } from '@/design';

type Row = {
  key: 'coverage' | 'applications' | 'medicare' | 'clinics' | 'helpers' | 'glossary';
  href: string;
  icon: typeof ShieldCheck;
  signal: SignalName;
};

const ROWS: Row[] = [
  { key: 'coverage', href: '/onboarding/coverage', icon: ShieldCheck, signal: 'lilac' },
  { key: 'applications', href: '/applications', icon: FolderOpen, signal: 'lilac' },
  { key: 'medicare', href: '/medicare', icon: Landmark, signal: 'lilac' },
  { key: 'clinics', href: '/clinics', icon: Stethoscope, signal: 'sky' },
  { key: 'helpers', href: '/helpers', icon: HeartHandshake, signal: 'sky' },
  { key: 'glossary', href: '/glossary', icon: BookOpen, signal: 'sky' },
];

export default function HelpScreen() {
  const { t } = useTranslation('help');
  const { reduceMotion } = useTheme();
  const today = todayISO();
  // Newest first; notices without a date go last.
  const notices = useMemo(
    () => [...getPack().notices].sort((a, b) => (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? '')),
    [],
  );
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(motion.slow));

  return (
    <Screen inTabs title={t('hub.title')} testID="help-screen">
      <NavigatorBar />
      <DraftBanner />
      <Text tone="muted">{t('hub.intro')}</Text>
      <VStack gap="sm">
        {ROWS.map((r, i) => (
          <Animated.View key={r.key} entering={enter(i)}>
            <ListRow
              testID={`help-${r.key}`}
              title={t(`hub.${r.key}.title`)}
              subtitle={t(`hub.${r.key}.subtitle`)}
              icon={r.icon}
              signal={r.signal}
              onPress={() => router.push(r.href as Href)}
            />
          </Animated.View>
        ))}
      </VStack>

      <SectionHeader title={t('hub.notices.title')} hint={t('hub.notices.hint')} />
      <VStack gap="sm">
        {notices.map((n, i) => (
          <Animated.View key={n.id} entering={enter(ROWS.length + i)}>
            <NoticeCard notice={n} today={today} />
          </Animated.View>
        ))}
      </VStack>
    </Screen>
  );
}
