import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Check, ClipboardList, Languages, Phone } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { buildCallScript } from '@/components/programs/callScript';
import { CheckRow } from '@/components/programs/CheckRow';
import { CoachStep } from '@/components/programs/CoachStep';
import { Field } from '@/components/programs/Field';
import { findMedication, findProgram, formatPhone, isPdf, phoneForSpeech, siteOf } from '@/components/programs/helpers';
import { useTrack } from '@/components/programs/useTrack';
import { loc } from '@/data/localize';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  HStack,
  radius,
  ReadAloud,
  Screen,
  Segmented,
  SourceChip,
  spacing,
  Tappable,
  Text,
  useTheme,
  VStack,
} from '@/design';
import { useProfile } from '@/hooks/useProfile';
import { i18next } from '@/i18n';
import { LANGUAGES, type Lang } from '@/i18n/languages';
import { haptic } from '@/services/haptics';
import { call, openExternal } from '@/services/links';
import { useApplications } from '@/state/applications';
import { useMedicines } from '@/state/medicines';
import { insuranceStatusOf, useScreener } from '@/state/screener';

const TOTAL = 4;

export default function CallCoachScreen() {
  const { id, drug } = useLocalSearchParams<{ id: string; drug?: string }>();
  const { t } = useTranslation('programs');
  const { palette, lang } = useTheme();
  const program = findProgram(id);
  const profile = useProfile();
  const screener = useScreener();
  const lastSelection = useMedicines((s) => s.lastSelection);
  const app = useApplications((s) => (program ? s.byProgram[program.id] : undefined));
  const update = useApplications((s) => s.update);
  const { ensureTracked } = useTrack(program?.id);

  // Step 1 — before you call (kept on screen only; documents start from the saved checklist)
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(app?.docs ?? {})) init[`doc-${k}`] = v;
    return init;
  });
  const [called, setCalled] = useState(false);
  const [scriptIn, setScriptIn] = useState<'mine' | 'en'>('mine');
  const [notes, setNotes] = useState(app?.notes ?? '');
  const [reference, setReference] = useState(app?.referenceNumber ?? '');
  const [saved, setSaved] = useState(false);

  // Step 4 — save notes and reference number (auto-tracks the program the first time).
  useEffect(() => {
    if (!program) return;
    const current = useApplications.getState().byProgram[program.id];
    if ((current?.notes ?? '') === notes && (current?.referenceNumber ?? '') === reference) return;
    const timer = setTimeout(() => {
      if (!current && !notes.trim() && !reference.trim()) return;
      ensureTracked(t('coach.autoTracked'));
      update(program.id, { notes, referenceNumber: reference });
      setSaved(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, reference, program, update, ensureTracked, t]);

  // The medicine: from the link, or the program's only medicine in this app.
  const medication = useMemo(() => {
    if (drug) return findMedication(drug);
    if (program && program.medicationIds.length === 1) return findMedication(program.medicationIds[0]);
    return undefined;
  }, [drug, program]);
  const strengthId = medication && lastSelection?.drugId === medication.id ? lastSelection.strengthId : null;

  const scriptLang: Lang = scriptIn === 'en' ? 'en' : lang;
  const script = useMemo(() => {
    const st = scriptLang === lang ? t : i18next.getFixedT(scriptLang, 'programs');
    return buildCallScript(st, scriptLang, {
      medication,
      strengthId,
      insurance: screener.coverage === null ? null : insuranceStatusOf(screener),
      householdSize: profile.householdSize,
      income: profile.income,
      incomeExact: screener.income?.kind === 'exact',
    });
  }, [scriptLang, lang, t, medication, strengthId, screener, profile]);

  if (!program) {
    return (
      <Screen back testID="call-coach">
        <EmptyState
          illustration="phone"
          title={t('coach.notFoundTitle')}
          body={t('coach.notFoundBody')}
          testID="coach-not-found"
        />
      </Screen>
    );
  }

  const items = [
    ...program.documents.map((d, i) => ({ key: `doc-${i}`, label: loc(d, lang) })),
    { key: 'pen', label: t('coach.itemPen') },
    { key: 'bottle', label: t('coach.itemBottle') },
    { key: 'prescriber', label: t('coach.itemPrescriber') },
  ];
  const readyCount = items.filter((i) => checks[i.key]).length;
  const step1Done = readyCount === items.length;
  const step4Done = saved || !!app?.notes.trim() || !!app?.referenceNumber.trim();

  const onCall = () => {
    if (!program.phone) return;
    haptic.press();
    setCalled(true);
    void call(program.phone);
  };

  const interpreter = program.interpreterAvailable === true;
  const enT = i18next.getFixedT('en', 'programs');

  return (
    <Screen back eyebrow={program.name} title={t('coach.title')} testID="call-coach">
      <Text tone="muted">{t('coach.intro')}</Text>

      <View>
        {/* 1. Before you call */}
        <CoachStep n={1} total={TOTAL} title={t('coach.beforeTitle')} done={step1Done} testID="coach-step-1">
          <Text variant="label" tone="muted">
            {t('coach.beforeBody')}
          </Text>
          <VStack gap="xs">
            {items.map((item) => (
              <CheckRow
                key={item.key}
                label={item.label}
                checked={!!checks[item.key]}
                onToggle={() => setChecks((c) => ({ ...c, [item.key]: !c[item.key] }))}
                testID={`coach-check-${item.key}`}
              />
            ))}
          </VStack>
          <Text variant="label" bold tone={step1Done ? 'mint' : 'muted'} tabular>
            {step1Done ? t('coach.allReady') : t('coach.readyCount', { ready: readyCount, total: items.length })}
          </Text>
        </CoachStep>

        {/* 2. The call */}
        <CoachStep n={2} total={TOTAL} title={t('coach.callTitle')} done={called} testID="coach-step-2">
          {program.phone ? (
            <>
              <Tappable
                onPress={onCall}
                feedback="none"
                accessibilityRole="link"
                accessibilityLabel={t('coach.callButtonA11y', {
                  name: program.name,
                  digits: phoneForSpeech(program.phone),
                })}
                accessibilityHint={t('card.callHint')}
                style={[styles.bigCall, { backgroundColor: palette.accent, shadowColor: palette.shadow }]}
                testID="coach-call">
                <View style={[styles.bigCallIcon, { backgroundColor: palette.onAccent }]}>
                  <Phone size={30} color={palette.accent} strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="heading" style={{ color: palette.onAccent }}>
                    {t('coach.callButton', { name: program.name })}
                  </Text>
                  <Text variant="subheading" tabular style={{ color: palette.onAccent }}>
                    {formatPhone(program.phone)}
                  </Text>
                </View>
              </Tappable>
              <Text variant="label" tone="muted">
                {t('coach.callTip')}
              </Text>
            </>
          ) : (
            <VStack gap="xs">
              <Text>{t('coach.noPhone')}</Text>
              {program.applicationUrl ? (
                <>
                  <Text variant="label" tone="muted">
                    {t('coach.noPhoneApply')}
                  </Text>
                  <Button
                    variant="secondary"
                    compact
                    external
                    label={
                      isPdf(program.applicationUrl)
                        ? t('card.openForm', { site: siteOf(program.applicationUrl) })
                        : t('card.openApplication', { site: siteOf(program.applicationUrl) })
                    }
                    onPress={() => void openExternal(program.applicationUrl ?? '')}
                  />
                </>
              ) : null}
            </VStack>
          )}
          <SourceChip
            sources={program.sources}
            verifiedAsOf={program.verifiedAsOf}
            recordId={`program:${program.id}`}
            title={program.name}
          />
        </CoachStep>

        {/* 3. What to say */}
        <CoachStep n={3} total={TOTAL} title={t('coach.sayTitle')} done={called} testID="coach-step-3">
          <Text variant="label" tone="muted">
            {t('coach.sayBody')}
          </Text>
          {lang !== 'en' ? (
            <Segmented
              accessibilityLabel={t('coach.scriptLang')}
              value={scriptIn}
              onChange={setScriptIn}
              options={[
                { value: 'mine', label: LANGUAGES[lang].nativeName, testID: 'coach-script-mine' },
                { value: 'en', label: t('coach.english'), testID: 'coach-script-en' },
              ]}
            />
          ) : null}
          <Card signal="lilac" treatment="solid" testID="coach-script">
            <VStack gap="sm">
              {script.map((line, i) => (
                <HStack key={`${i}-${line}`} gap="sm" wrap={false} align="flex-start">
                  <View style={[styles.quoteBar, { backgroundColor: palette.signals.lilac.solid }]} />
                  <Text variant="subheading" style={{ flex: 1 }} selectable>
                    {line}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Card>
          <HStack gap="sm">
            <ReadAloud text={script.join(' ')} lang={scriptLang} label={t('coach.listenLabel')} />
            <Text variant="caption" tone="muted" style={{ flex: 1, minWidth: 160 }}>
              {t('coach.scriptNote')}
            </Text>
          </HStack>
          {interpreter ? (
            <Banner
              icon={Languages}
              title={t('coach.interpreter')}
              body={lang !== 'en' ? t('coach.interpreterSay', { language: LANGUAGES[lang].englishName }) : undefined}
              testID="coach-interpreter"
            />
          ) : lang !== 'en' ? (
            <Banner icon={Languages} title={t('coach.englishTip')} testID="coach-english-tip" />
          ) : null}
        </CoachStep>

        {/* 4. During the call */}
        <CoachStep n={4} total={TOTAL} title={t('coach.duringTitle')} done={step4Done} last testID="coach-step-4">
          <Text variant="label" tone="muted">
            {t('coach.duringBody')}
          </Text>
          <Field
            label={t('coach.notesLabel')}
            value={notes}
            onChangeText={(v) => {
              setSaved(false);
              setNotes(v);
            }}
            placeholder={t('coach.notesPlaceholder')}
            multiline
            testID="coach-notes"
          />
          <Field
            label={t('coach.refLabel')}
            value={reference}
            onChangeText={(v) => {
              setSaved(false);
              setReference(v);
            }}
            placeholder={t('coach.refPlaceholder')}
            testID="coach-reference"
          />
          {saved ? (
            <View accessibilityLiveRegion="polite" style={styles.saved}>
              <Check size={18} color={palette.signals.mint.ink} />
              <Text variant="label" bold tone="mint">
                {t('coach.saved')}
              </Text>
            </View>
          ) : null}
          <Button
            variant="ghost"
            compact
            icon={ClipboardList}
            label={t('coach.seeApplications')}
            onPress={() => router.push('/applications' as Href)}
            style={{ alignSelf: 'flex-start' }}
            testID="coach-applications"
          />
        </CoachStep>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigCall: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  bigCallIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  quoteBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
