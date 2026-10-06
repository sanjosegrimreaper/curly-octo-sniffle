import { router, useLocalSearchParams, type Href } from 'expo-router';
import { CalendarClock, ClipboardCheck, ClipboardList, FileCheck2, PhoneCall, Send } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CheckRow } from '@/components/programs/CheckRow';
import { docsProgress, findProgram } from '@/components/programs/helpers';
import { ProgramCard } from '@/components/programs/ProgramCard';
import { ProgressBar } from '@/components/programs/ProgressBar';
import { useTrack } from '@/components/programs/useTrack';
import { DraftBanner } from '@/components/DraftBanner';
import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import {
  Button,
  Card,
  EmptyState,
  HStack,
  motion,
  Screen,
  SourceChip,
  spacing,
  Text,
  useTheme,
  VStack,
  type SignalName,
} from '@/design';
import { matchProgram } from '@/domain';
import { useProfile } from '@/hooks/useProfile';
import { useApplications } from '@/state/applications';

export default function ProgramDetailScreen() {
  const { id, drug } = useLocalSearchParams<{ id: string; drug?: string }>();
  const { t } = useTranslation('programs');
  const { lang, reduceMotion } = useTheme();
  const program = findProgram(id);
  const profile = useProfile();
  const match = useMemo(() => (program ? matchProgram(program, profile, getPack().fpl) : null), [program, profile]);
  const docs = useApplications((s) => (program ? s.byProgram[program.id]?.docs : undefined));
  const toggleDoc = useApplications((s) => s.toggleDoc);
  const { tracked, ensureTracked } = useTrack(program?.id);

  if (!program || !match) {
    return (
      <Screen back testID="program-detail">
        <EmptyState
          illustration="magnifier"
          title={t('detail.notFoundTitle')}
          body={t('detail.notFoundBody')}
          testID="program-not-found"
          action={<Button label={t('detail.findMedicine')} onPress={() => router.replace('/find' as Href)} testID="program-find" />}
        />
      </Screen>
    );
  }

  const drugQuery = drug ? `?drug=${encodeURIComponent(drug)}` : '';
  const { ready, total } = docsProgress(program, docs);
  const sendWhere = loc(program.sendWhere, lang);
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(120 + i * 40).duration(motion.slow));

  const onToggle = (i: number) => {
    ensureTracked();
    toggleDoc(program.id, i);
    const after = docsProgress(program, useApplications.getState().byProgram[program.id]?.docs);
    AccessibilityInfo.announceForAccessibility(t('detail.readyCount', { ready: after.ready, total: after.total }));
  };

  return (
    <Screen
      back
      eyebrow={t('detail.eyebrow')}
      title={program.name}
      testID="program-detail"
      footer={
        <Button
          icon={PhoneCall}
          label={t('card.callCoach')}
          hint={t('card.callCoachHint')}
          onPress={() => router.push(`/call-coach/${program.id}${drugQuery}` as Href)}
          testID="program-detail-coach"
        />
      }>
      <DraftBanner />
      <ProgramCard match={match} medicationId={drug} variant="expanded" showActions={false} hideName />

      {/* Documents checklist */}
      <Animated.View entering={enter(0)}>
        <Card testID="program-checklist">
          <VStack gap="sm">
            <SectionTitle icon={FileCheck2} signal="lilac" title={t('detail.checklistTitle')} />
            {total > 0 ? (
              <>
                <Text variant="label" tone="muted">
                  {t('detail.checklistBody')}
                </Text>
                <HStack gap="xs" style={{ justifyContent: 'space-between' }}>
                  <Text variant="label" bold tabular testID="program-ready-count">
                    {t('detail.readyCount', { ready, total })}
                  </Text>
                  {ready === total ? (
                    <Text variant="label" bold tone="mint">
                      {t('detail.allReady')}
                    </Text>
                  ) : null}
                </HStack>
                <ProgressBar value={total ? ready / total : 0} accessibilityLabel={t('detail.readyCount', { ready, total })} />
                <VStack gap="xs">
                  {program.documents.map((d, i) => (
                    <CheckRow
                      key={`${program.id}-${i}`}
                      label={loc(d, lang)}
                      checked={!!docs?.[String(i)]}
                      onToggle={() => onToggle(i)}
                      testID={`program-doc-${i}`}
                    />
                  ))}
                </VStack>
              </>
            ) : (
              <Text>{t('detail.noDocs')}</Text>
            )}
            <SourceChip sources={program.sources} verifiedAsOf={program.verifiedAsOf} recordId={`program:${program.id}`} title={program.name} />
          </VStack>
        </Card>
      </Animated.View>

      {/* Where to send it */}
      <Animated.View entering={enter(1)}>
        <Card>
          <VStack gap="sm">
            <SectionTitle icon={Send} signal="sky" title={t('detail.sendTitle')} />
            <Text tone={sendWhere ? 'default' : 'muted'}>{sendWhere || t('detail.sendUnknown')}</Text>
            {sendWhere ? (
              <SourceChip sources={program.sources} verifiedAsOf={program.verifiedAsOf} recordId={`program:${program.id}`} title={program.name} />
            ) : null}
          </VStack>
        </Card>
      </Animated.View>

      {/* Renewal */}
      <Animated.View entering={enter(2)}>
        <Card>
          <VStack gap="sm">
            <SectionTitle icon={CalendarClock} signal="tangerine" title={t('detail.renewTitle')} />
            {program.termMonths !== null ? (
              <>
                <Text>{t('detail.renewMonths', { count: program.termMonths })}</Text>
                <SourceChip sources={program.sources} verifiedAsOf={program.verifiedAsOf} recordId={`program:${program.id}`} title={program.name} />
              </>
            ) : (
              <Text tone="muted">{t('detail.renewUnknown')}</Text>
            )}
          </VStack>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <Button
          variant="secondary"
          icon={tracked ? ClipboardCheck : ClipboardList}
          label={tracked ? t('card.tracking') : t('card.track')}
          onPress={() => {
            ensureTracked();
            router.push('/applications' as Href);
          }}
          testID="program-detail-track"
        />
      </Animated.View>
      <View style={{ height: spacing.md }} />
    </Screen>
  );
}

function SectionTitle({ icon: Icon, signal, title }: { icon: typeof Send; signal: SignalName; title: string }) {
  const { palette } = useTheme();
  const s = palette.signals[signal];
  return (
    <HStack gap="sm" wrap={false}>
      <View style={[styles.icon, { backgroundColor: s.tint }]}>
        <Icon size={20} color={s.ink} />
      </View>
      <Text variant="subheading" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
    </HStack>
  );
}

const styles = StyleSheet.create({
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
