import { router, type Href } from 'expo-router';
import {
  ArrowRight,
  Bell,
  BellOff,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  FileCheck2,
  Info,
  Minus,
  NotebookPen,
  PartyPopper,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Undo2,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import {
  Badge,
  Banner,
  Button,
  Card,
  HStack,
  minTap,
  motion,
  radius,
  SourceChip,
  spacing,
  Tappable,
  Text,
  useTheme,
  VStack,
} from '@/design';
import type { Program } from '@/data/schemas';
import { todayISO } from '@/domain';
import { formatDate } from '@/i18n/format';
import { haptic } from '@/services/haptics';
import { addCalendarEvent, cancelReminder, scheduleDateReminder } from '@/services/notifications';
import { useApplications, type Application, type ApplicationStep } from '@/state/applications';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

import { addMonthsISO, coveredNames, docsProgress, formatPhone } from './helpers';
import { ProgressBar } from './ProgressBar';
import { StepTrack, TRACK_LENGTH, TRACK_STEPS, trackPosition } from './StepTrack';

const IS_WEB = Platform.OS === 'web';

/** One tracked application: steps, documents, notes and the renewal date. */
export function ApplicationCard({
  application,
  program,
  index,
}: {
  application: Application;
  program: Program | undefined;
  index: number;
}) {
  const { t } = useTranslation('programs');
  const { lang, reduceMotion } = useTheme();
  const update = useApplications((s) => s.update);
  const untrack = useApplications((s) => s.untrack);
  const openSheet = useUi((s) => s.openSheet);
  const closeSheet = useUi((s) => s.closeSheet);
  const showToast = useUi((s) => s.showToast);
  const id = application.programId;
  const name = program?.name ?? t('tracker.unknownProgram');

  const confirmUntrack = () =>
    openSheet({
      kind: 'custom',
      title: t('tracker.untrackTitle'),
      render: () => (
        <VStack gap="sm">
          <Text>{t('tracker.untrackBody', { program: name })}</Text>
          <Button
            variant="danger"
            icon={Trash2}
            label={t('tracker.untrackConfirm')}
            onPress={() => {
              void cancelReminder(application.reminderId);
              untrack(id);
              closeSheet();
              showToast(t('tracker.untracked', { program: name }), 'info');
            }}
            testID={`app-untrack-confirm-${id}`}
          />
          <Button
            variant="secondary"
            label={t('tracker.untrackKeep')}
            onPress={closeSheet}
            testID={`app-untrack-keep-${id}`}
          />
        </VStack>
      ),
    });

  const untrackButton = (
    <Button
      variant="ghost"
      compact
      icon={Trash2}
      label={t('tracker.untrack')}
      onPress={confirmUntrack}
      style={{ alignSelf: 'flex-start' }}
      testID={`app-untrack-${id}`}
    />
  );

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(index * 40).duration(motion.slow)}
      testID={`app-card-${id}`}>
      <Card signal={application.step === 'approved' ? 'mint' : 'lilac'} treatment="outline">
        <VStack gap="md">
          <VStack gap="xxs">
            <Text variant="heading">{name}</Text>
            {program ? (
              <Text variant="label" tone="muted">
                {coveredNames(program, lang).join(', ')}
              </Text>
            ) : (
              <Text variant="label" tone="muted">
                {t('tracker.unknownProgramBody')}
              </Text>
            )}
          </VStack>

          {program ? (
            <>
              <StepSection application={application} onStep={(step) => update(id, { step })} />
              <Divider />
              <DocsSection program={program} application={application} />
              <Divider />
              <NotesSection application={application} />
              <Divider />
              <RenewSection program={program} application={application} />
              <SourceChip
                sources={program.sources}
                verifiedAsOf={program.verifiedAsOf}
                recordId={`program:${program.id}`}
                title={program.name}
              />
            </>
          ) : null}
          {untrackButton}
        </VStack>
      </Card>
    </Animated.View>
  );
}

function Divider() {
  const { palette } = useTheme();
  return <View style={{ height: 1, backgroundColor: palette.border }} />;
}

function StepSection({ application, onStep }: { application: Application; onStep: (s: ApplicationStep) => void }) {
  const { t } = useTranslation('programs');
  const { reduceMotion } = useTheme();
  const { step, programId } = application;
  const pos = trackPosition(step);
  const label = t(`steps.${step}`);

  const go = (next: ApplicationStep) => {
    onStep(next);
    if (next === 'approved') haptic.success();
    const nextLabel = t(`steps.${next}`);
    AccessibilityInfo.announceForAccessibility(
      t('tracker.progressA11y', { n: trackPosition(next) + 1, total: TRACK_LENGTH, step: nextLabel }),
    );
  };
  const nextStep = pos < TRACK_STEPS.length - 1 ? TRACK_STEPS[pos + 1] : undefined;
  const prevStep: ApplicationStep | undefined =
    step === 'approved' || step === 'denied' ? 'waiting' : pos > 0 ? TRACK_STEPS[pos - 1] : undefined;

  return (
    <VStack gap="sm">
      <StepTrack step={step} onChange={go} testID={`app-steps-${programId}`} />
      <Animated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
        <Text variant="caption" bold tone="lilac">
          {t('tracker.stepOf', { n: pos + 1, total: TRACK_LENGTH })}
        </Text>
        <Text variant="subheading" testID={`app-step-label-${programId}`}>
          {label}
        </Text>
      </Animated.View>

      {step === 'approved' ? (
        <Banner tone="success" icon={PartyPopper} title={t('steps.approved')} body={t('tracker.acceptedNote')} />
      ) : null}
      {step === 'denied' ? <Banner icon={Info} title={t('steps.denied')} body={t('tracker.deniedNote')} /> : null}

      <VStack gap="xs">
        {step === 'waiting' ? (
          <>
            <Button
              variant="secondary"
              compact
              icon={ThumbsUp}
              label={t('tracker.yes')}
              onPress={() => go('approved')}
              testID={`app-yes-${programId}`}
            />
            <Button
              variant="secondary"
              compact
              icon={ThumbsDown}
              label={t('tracker.no')}
              onPress={() => go('denied')}
              testID={`app-no-${programId}`}
            />
          </>
        ) : nextStep ? (
          <Button
            variant="secondary"
            compact
            icon={ArrowRight}
            label={t('tracker.next', { step: t(`steps.${nextStep}`) })}
            onPress={() => go(nextStep)}
            testID={`app-next-${programId}`}
          />
        ) : null}
        {prevStep ? (
          <Button
            variant="ghost"
            compact
            icon={Undo2}
            label={t('tracker.back')}
            onPress={() => go(prevStep)}
            style={{ alignSelf: 'flex-start' }}
            testID={`app-back-${programId}`}
          />
        ) : null}
      </VStack>
    </VStack>
  );
}

function DocsSection({ program, application }: { program: Program; application: Application }) {
  const { t } = useTranslation('programs');
  const { ready, total } = docsProgress(program, application.docs);
  return (
    <VStack gap="xs">
      <SectionLabel
        icon={FileCheck2}
        text={total > 0 ? t('tracker.docsProgress', { ready, total }) : t('tracker.noDocsListed')}
      />
      {total > 0 ? (
        <ProgressBar value={ready / total} accessibilityLabel={t('tracker.docsProgress', { ready, total })} />
      ) : null}
      <LinkRow
        label={t('tracker.openChecklist')}
        onPress={() => router.push(`/program/${program.id}` as Href)}
        testID={`app-checklist-${program.id}`}
      />
    </VStack>
  );
}

function NotesSection({ application }: { application: Application }) {
  const { t } = useTranslation('programs');
  const notes = application.notes.trim();
  const ref = application.referenceNumber.trim();
  return (
    <VStack gap="xs">
      <SectionLabel icon={NotebookPen} text={t('tracker.notes')} />
      <Text tone={notes ? 'default' : 'muted'} numberOfLines={4}>
        {notes || t('tracker.noNotes')}
      </Text>
      {ref ? (
        <Text variant="label" bold tabular selectable>
          {t('tracker.reference', { ref })}
        </Text>
      ) : null}
      <LinkRow
        label={t('tracker.openCoach')}
        onPress={() => router.push(`/call-coach/${application.programId}` as Href)}
        testID={`app-coach-${application.programId}`}
      />
    </VStack>
  );
}

function RenewSection({ program, application }: { program: Program; application: Application }) {
  const { t } = useTranslation('programs');
  const { palette, lang } = useTheme();
  const update = useApplications((s) => s.update);
  const showToast = useUi((s) => s.showToast);
  const privateNotifications = useSettings((s) => s.privateNotifications);
  const today = todayISO();
  const id = program.id;

  const suggested = program.termMonths !== null ? addMonthsISO(today, program.termMonths) : null;
  const date = application.renewBy ?? suggested;

  const setDate = (next: string) => {
    if (application.reminderId) {
      void cancelReminder(application.reminderId);
      update(id, { renewBy: next, reminderId: null });
      showToast(t('tracker.reminderMoved'), 'info');
    } else {
      update(id, { renewBy: next });
    }
    AccessibilityInfo.announceForAccessibility(formatDate(next, lang, 'long'));
  };

  /** Lock-screen text never names the program or medicine unless the person turned that off. */
  const texts = () => {
    if (privateNotifications) {
      const title = t('tracker.reminderTitlePrivate');
      return {
        title,
        body: t('tracker.reminderBodyPrivate'),
        calendarTitle: t('tracker.calendarTitlePrivate'),
        calendarNotes: title,
      };
    }
    const title = t('tracker.reminderTitle', { program: program.name });
    const body = program.phone
      ? t('tracker.reminderBody', { program: program.name, phone: formatPhone(program.phone) })
      : t('tracker.reminderBodyNoPhone', { program: program.name });
    return { title, body, calendarTitle: title, calendarNotes: body };
  };

  const remind = async () => {
    if (!date) return;
    if (date <= today) {
      showToast(t('tracker.reminderPast'), 'caution');
      return;
    }
    const { title, body } = texts();
    const reminderId = await scheduleDateReminder(title, body, date);
    if (reminderId) {
      if (application.reminderId) void cancelReminder(application.reminderId);
      update(id, { renewBy: date, reminderId });
      haptic.success();
      showToast(t('tracker.reminderSaved', { date: formatDate(date, lang, 'long') }), 'success');
    } else {
      showToast(IS_WEB ? t('tracker.webNote') : t('tracker.reminderFailed'), 'caution');
    }
  };

  const addToCalendar = async () => {
    if (!date) return;
    const { calendarTitle, calendarNotes } = texts();
    const ok = await addCalendarEvent(calendarTitle, date, calendarNotes);
    if (ok) {
      update(id, { renewBy: date });
      haptic.success();
      showToast(t('tracker.calendarAdded'), 'success');
    } else {
      showToast(IS_WEB ? t('tracker.webNote') : t('tracker.calendarFailed'), 'info');
    }
  };

  const cancel = () => {
    void cancelReminder(application.reminderId);
    update(id, { reminderId: null });
    showToast(t('tracker.reminderCanceled'), 'info');
  };

  if (!date) {
    return (
      <VStack gap="xs">
        <SectionLabel icon={CalendarClock} text={t('tracker.renewTitle')} />
        <Text variant="label" tone="muted">
          {t('tracker.renewUnknownTerm')}
        </Text>
        <Button
          variant="secondary"
          compact
          icon={CalendarClock}
          label={t('tracker.setDate')}
          onPress={() => setDate(addMonthsISO(today, 1))}
          style={{ alignSelf: 'flex-start' }}
          testID={`app-set-date-${id}`}
        />
      </VStack>
    );
  }

  const earlier = addMonthsISO(date, -1);
  const canEarlier = earlier > today;

  return (
    <VStack gap="sm">
      <SectionLabel icon={CalendarClock} text={t('tracker.renewTitle')} />
      <View style={[styles.dateRow, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
        <RoundButton
          icon={Minus}
          label={t('tracker.monthEarlier')}
          disabled={!canEarlier}
          onPress={() => setDate(earlier)}
          testID={`app-renew-minus-${id}`}
        />
        <Text
          variant="subheading"
          center
          tabular
          style={{ flex: 1 }}
          testID={`app-renew-date-${id}`}
          accessibilityLiveRegion="polite">
          {formatDate(date, lang, 'long')}
        </Text>
        <RoundButton
          icon={Plus}
          label={t('tracker.monthLater')}
          onPress={() => setDate(addMonthsISO(date, 1))}
          testID={`app-renew-plus-${id}`}
        />
      </View>
      {application.renewBy === null && program.termMonths !== null ? (
        <Text variant="label" tone="muted">
          {t('tracker.renewSuggested', { count: program.termMonths })}
        </Text>
      ) : null}

      {application.reminderId ? (
        <HStack gap="xs">
          <Badge signal="mint" icon={Bell} label={t('tracker.reminderSet', { date: formatDate(date, lang) })} />
          <Button
            variant="ghost"
            compact
            icon={BellOff}
            label={t('tracker.cancelReminder')}
            onPress={cancel}
            testID={`app-cancel-reminder-${id}`}
          />
        </HStack>
      ) : null}

      {IS_WEB ? (
        <HStack gap="xs" wrap={false} align="flex-start">
          <Info size={18} color={palette.signals.sky.ink} style={{ marginTop: 2 }} />
          <Text variant="label" tone="muted" style={{ flex: 1 }}>
            {t('tracker.webNote')}
          </Text>
        </HStack>
      ) : (
        <VStack gap="xs">
          {application.reminderId ? null : (
            <Button
              variant="secondary"
              compact
              icon={Bell}
              label={t('tracker.remind')}
              onPress={() => void remind()}
              testID={`app-remind-${id}`}
            />
          )}
          <Button
            variant="secondary"
            compact
            icon={CalendarPlus}
            label={t('tracker.calendar')}
            onPress={() => void addToCalendar()}
            testID={`app-calendar-${id}`}
          />
        </VStack>
      )}
    </VStack>
  );
}

function SectionLabel({ icon: Icon, text }: { icon: typeof Info; text: string }) {
  const { palette } = useTheme();
  return (
    <HStack gap="xs" wrap={false}>
      <Icon size={18} color={palette.signals.lilac.ink} />
      <Text variant="label" bold style={{ flex: 1 }}>
        {text}
      </Text>
    </HStack>
  );
}

function LinkRow({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const { palette } = useTheme();
  return (
    <Tappable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} style={styles.link} testID={testID}>
      <Text variant="label" bold tone="accent">
        {label}
      </Text>
      <ChevronRight size={18} color={palette.accentInk} />
    </Tappable>
  );
}

function RoundButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { palette } = useTheme();
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      testID={testID}
      style={[styles.round, { backgroundColor: palette.surface, borderColor: palette.accent }]}>
      <Icon size={22} color={palette.accentInk} strokeWidth={2.5} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: minTap, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xxs },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  round: {
    width: minTap,
    height: minTap,
    borderRadius: minTap / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
