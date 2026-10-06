import { router, type Href } from 'expo-router';
import { CircleCheck, HandHeart, HeartHandshake, Search, Ban, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Banner,
  Button,
  Card,
  EmptyState,
  GlossaryChip,
  HStack,
  motion,
  spacing,
  Text,
  useTheme,
  VStack,
  type SignalName,
} from '@/design';
import { isStale, todayISO, type ProgramMatch } from '@/domain';
import { useProfile, useProgramMatches } from '@/hooks/useProfile';

import { findMedication, shortMedicineName } from './helpers';
import { ProgramCard } from './ProgramCard';

/** The "Help paying" tab of Results: assistance programs for one medicine, honestly grouped. */
export function HelpPayingTab({ medicationId }: { medicationId: string }) {
  const { t } = useTranslation('programs');
  const { palette, reduceMotion } = useTheme();
  const matches = useProgramMatches(medicationId);
  const profile = useProfile();
  const medication = findMedication(medicationId);

  const { likely, worthChecking, closed } = matches;
  const openCount = likely.length + worthChecking.length;
  const total = openCount + closed.length;

  useEffect(() => {
    if (!medication) return;
    AccessibilityInfo.announceForAccessibility(
      total === 0 ? t('tab.emptyTitle') : t('tab.found', { count: openCount }),
    );
  }, [medication, total, openCount, t]);

  if (!medication) {
    return (
      <EmptyState
        illustration="magnifier"
        title={t('tab.unknownMedicine')}
        body={t('tab.unknownMedicineBody')}
        testID="help-paying-unknown"
      />
    );
  }

  const today = todayISO();
  const stale = [...likely, ...worthChecking, ...closed].some((m) => isStale(m.program.verifiedAsOf, today));
  const needsProfile = profile.income === null || profile.householdSize === null;
  const medName = shortMedicineName(medication);

  const cards = (list: ProgramMatch[], base: number) =>
    list.map((m, i) => <ProgramCard key={m.program.id} match={m} medicationId={medicationId} index={base + i} />);

  return (
    <VStack gap="lg" style={{ paddingBottom: spacing.md }}>
      {/* Intro */}
      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
        <Card signal="lilac" treatment="solid">
          <HStack gap="sm" wrap={false} align="flex-start">
            <View style={[styles.heroIcon, { backgroundColor: palette.surface, borderColor: palette.signals.lilac.solid }]}>
              <HandHeart size={26} color={palette.signals.lilac.ink} />
            </View>
            <VStack gap="xs" style={{ flex: 1 }}>
              <Text variant="heading">{t('tab.introTitle', { medicine: medName })}</Text>
              <Text variant="label">{t('tab.introBody')}</Text>
              <GlossaryChip termId="pap" />
            </VStack>
          </HStack>
        </Card>
      </Animated.View>

      {total > 0 && needsProfile ? (
        <Banner title={t('tab.profileTitle')} body={t('tab.profileBody')} testID="help-paying-profile-banner">
          <Button
            compact
            variant="secondary"
            label={t('tab.profileButton')}
            onPress={() => router.push('/onboarding/household' as Href)}
            style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}
            testID="help-paying-add-profile"
          />
        </Banner>
      ) : null}

      {stale ? <Banner tone="caution" title={t('tab.staleTitle')} body={t('tab.staleBody')} testID="help-paying-stale" /> : null}

      {total === 0 ? (
        <EmptyState
          illustration="folder"
          title={t('tab.emptyTitle')}
          body={medication.marketStatus === 'genericAvailable' ? t('tab.emptyGeneric') : t('tab.emptyOther')}
          testID="help-paying-empty"
          action={
            <Button
              icon={HeartHandshake}
              label={t('tab.emptyHelp')}
              onPress={() => router.push('/help' as Href)}
              testID="help-paying-empty-help"
            />
          }
        />
      ) : null}

      {likely.length > 0 ? (
        <Section icon={CircleCheck} signal="mint" title={t('tab.likelyTitle')} explain={t('tab.likelyExplain')} count={likely.length}>
          {cards(likely, 0)}
        </Section>
      ) : null}

      {worthChecking.length > 0 ? (
        <Section icon={Search} signal="sky" title={t('tab.worthTitle')} explain={t('tab.worthExplain')} count={worthChecking.length}>
          {cards(worthChecking, likely.length)}
        </Section>
      ) : null}

      {openCount === 0 && closed.length > 0 ? (
        <Banner tone="caution" title={t('tab.allClosed')} testID="help-paying-all-closed" />
      ) : null}

      {closed.length > 0 ? (
        <Section icon={Ban} signal="coral" title={t('tab.closedTitle')} explain={t('tab.closedExplain')} count={closed.length}>
          {cards(closed, openCount)}
        </Section>
      ) : null}

      {/* More local help */}
      <Card signal="lilac" treatment="solid" testID="help-paying-more-help">
        <HStack gap="sm" wrap={false} align="flex-start">
          <HeartHandshake size={26} color={palette.signals.lilac.ink} />
          <VStack gap="xs" style={{ flex: 1 }}>
            <Text variant="subheading">{t('tab.moreHelpTitle')}</Text>
            <Text variant="label">{t('tab.moreHelpBody')}</Text>
            <Button
              compact
              variant="secondary"
              label={t('tab.moreHelpButton')}
              onPress={() => router.push('/help' as Href)}
              style={{ alignSelf: 'flex-start', marginTop: spacing.xxs }}
              testID="help-paying-open-help"
            />
          </VStack>
        </HStack>
      </Card>
    </VStack>
  );
}

function Section({
  icon: Icon,
  signal,
  title,
  explain,
  count,
  children,
}: {
  icon: LucideIcon;
  signal: SignalName;
  title: string;
  explain: string;
  count: number;
  children: React.ReactNode;
}) {
  const { palette } = useTheme();
  const s = palette.signals[signal];
  return (
    <VStack gap="sm">
      <HStack gap="sm" wrap={false} align="flex-start">
        <View style={[styles.sectionIcon, { backgroundColor: s.tint, borderColor: s.solid }]}>
          <Icon size={20} color={s.ink} />
        </View>
        <VStack gap="xxs" style={{ flex: 1 }}>
          <HStack gap="xs">
            <Text variant="subheading" style={{ flexShrink: 1 }}>
              {title}
            </Text>
            <View style={[styles.count, { backgroundColor: s.tint, borderColor: s.solid }]}>
              <Text variant="caption" bold tabular style={{ color: s.ink }}>
                {String(count)}
              </Text>
            </View>
          </HStack>
          <Text variant="label" tone="muted">
            {explain}
          </Text>
        </VStack>
      </HStack>
      {children}
    </VStack>
  );
}

const styles = StyleSheet.create({
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { minWidth: 28, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
