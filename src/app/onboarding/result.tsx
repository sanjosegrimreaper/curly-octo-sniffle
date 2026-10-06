import { router } from 'expo-router';
import {
  Compass,
  Info,
  MapPin,
  RotateCcw,
  ShieldQuestionMark,
  ShieldX,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { CelebrationBurst } from '@/components/onboarding/CelebrationBurst';
import { bracketParts, isJustOverLimit, rangeKey, ruleUsesIncome } from '@/components/onboarding/income';
import { NoticeBanner } from '@/components/onboarding/NoticeBanner';
import { noticesFor, ResultCard } from '@/components/onboarding/ResultCard';
import { ScreenerBridge, useScreenerRoute } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { getPack } from '@/data/pack';
import { Button, EmptyState, motion, radius, ReadAloud, Screen, spacing, Text, useTheme } from '@/design';
import { buildBrackets } from '@/domain';
import { useProfile, usePcts, useRuleResults } from '@/hooks/useProfile';
import { formatDollars } from '@/i18n/format';
import { haptic } from '@/services/haptics';
import { wipePersonalData } from '@/state/session';
import { useScreener } from '@/state/screener';
import { useUi } from '@/state/ui';

const ROUTE = ROUTES.result;

/**
 * The Bridge completes: a short celebration, then calm, plain-language result cards
 * (may qualify / worth checking), each with its limit, next steps, links, sources and notices.
 */
export default function ResultScreen() {
  const { t } = useTranslation('onboarding');
  const { palette, lang, reduceMotion } = useTheme();
  const back = useScreenerRoute(ROUTE);
  const screener = useScreener();
  const results = useRuleResults();
  const profile = useProfile();
  const pcts = usePcts();
  const openSheet = useUi((s) => s.openSheet);
  const ease = Easing.bezier(...motion.easing);

  const income = screener.income;
  const incomeKnown = income?.kind === 'bracket' || income?.kind === 'exact';
  // Without an income answer, only rules that don't depend on income can be estimated.
  const visible = results.filter((r) => r.tier !== 'notLikely' && (incomeKnown || !ruleUsesIncome(r.rule)));
  // Programs that may help, vs. "standard" options (e.g. Covered California plans without federal help).
  const helpful = visible.filter((r) => r.rule.programKey !== 'standard');
  const size = profile.householdSize;
  const exactAnnual = income?.kind === 'exact' ? income.annual : null;
  // Rules missed only because an exact income is a little over the limit: "Some income may not count."
  const justOver = results.filter((r) => isJustOverLimit(r, getPack().fpl, size, exactAnnual));
  const noneHelp = incomeKnown && helpful.length === 0;
  // Standard options: the ones that apply, or (when nothing else fits) every standard rule in the pack.
  const standardShown = visible.filter((r) => r.rule.programKey === 'standard');
  const standard =
    noneHelp && standardShown.length === 0
      ? results.filter((r) => r.rule.programKey === 'standard' && !justOver.includes(r))
      : standardShown;
  // Celebrate only when something may help; otherwise stay calm.
  const celebrate = helpful.length > 0;

  useEffect(() => {
    if (celebrate) haptic.success();
    AccessibilityInfo.announceForAccessibility(
      helpful.length > 0 ? t('result.announce', { count: helpful.length }) : t('result.announceNone'),
    );
    // Announce once, when the result first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (to: string) => {
    useScreener.getState().update({ completedAt: new Date().toISOString() });
    router.replace(href(to));
  };

  const startOver = () =>
    openSheet({ kind: 'custom', title: t('result.startOverTitle'), render: () => <StartOverConfirm /> });

  // "Your answers" chips — show the work behind the estimate.
  const answers = useMemo(() => {
    const out: { key: string; icon: LucideIcon; text: string }[] = [];
    if (screener.coverage === 'no') out.push({ key: 'cov', icon: ShieldX, text: t('result.answers.noInsurance') });
    if (screener.coverage === 'unsure')
      out.push({ key: 'cov', icon: ShieldQuestionMark, text: t('result.answers.unsureInsurance') });
    if (screener.county) {
      const c = getPack().region.counties.find((x) => x.id === screener.county);
      out.push({ key: 'county', icon: MapPin, text: c ? c.name : t('result.answers.otherCounty') });
    }
    if (size !== null) out.push({ key: 'size', icon: Users, text: t('household.people', { count: size }) });
    if (income?.kind === 'bracket') {
      const b = buildBrackets(getPack().fpl, income.fplYear, income.householdSize, pcts)[income.index];
      if (b) {
        const p = bracketParts(b, 'year');
        out.push({
          key: 'income',
          icon: Wallet,
          text: t(`income.${rangeKey(p, 'year')}`, {
            min: 'min' in p ? formatDollars(p.min, lang) : '',
            max: 'max' in p ? formatDollars(p.max, lang) : '',
          }),
        });
      }
    } else if (income?.kind === 'exact') {
      out.push({
        key: 'income',
        icon: Wallet,
        text: t('result.answers.exactIncome', { amount: formatDollars(income.annual, lang) }),
      });
    } else if (income?.kind === 'skip') {
      out.push({ key: 'income', icon: Wallet, text: t('result.answers.incomeSkipped') });
    }
    return out;
  }, [screener.coverage, screener.county, size, income, pcts, lang, t]);

  const title = helpful.length > 0 ? t('result.title') : t('result.titleNone');
  const countText = helpful.length > 0 ? t('result.count', { count: helpful.length }) : null;

  return (
    <Screen
      back={back}
      testID="screen-result"
      right={<ReadAloud text={[title, countText, t('result.estimate')].filter(Boolean).join(' ')} />}
      top={<ScreenerBridge route={ROUTE} />}
      footer={
        <>
          <Button label={t('result.compare')} onPress={() => finish(ROUTES.find)} testID="result-compare" />
          <Button
            variant="secondary"
            label={t('result.goPlan')}
            onPress={() => finish(ROUTES.home)}
            testID="result-go-plan"
          />
        </>
      }>
      {/* The celebration: a badge pops in with a confetti burst, then everything settles. */}
      <View style={styles.hero}>
        {celebrate ? (
          <View style={styles.badgeWrap}>
            <CelebrationBurst size={176} delay={motion.slow} />
            <Animated.View
              entering={reduceMotion ? undefined : ZoomIn.delay(motion.slow).springify().damping(11).stiffness(200)}
              style={[styles.badge, { backgroundColor: palette.accent, shadowColor: palette.shadow }]}
              testID="result-celebration">
              <Sparkles size={34} color={palette.onAccent} />
            </Animated.View>
          </View>
        ) : (
          <View style={[styles.calmBadge, { backgroundColor: palette.accentSoft }]}>
            <Compass size={30} color={palette.accentInk} />
          </View>
        )}
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(motion.slow + 120)
                  .duration(motion.slow)
                  .easing(ease)
          }
          style={{ gap: spacing.xxs, alignItems: 'center' }}>
          {celebrate ? (
            <Text variant="label" tone="accent" bold center>
              {t('result.eyebrow')}
            </Text>
          ) : null}
          <Text variant="title" center testID="result-title">
            {title}
          </Text>
          {countText ? (
            <Text tone="muted" center testID="result-count">
              {countText}
            </Text>
          ) : null}
        </Animated.View>
      </View>

      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.delay(motion.slow + 220).duration(motion.slow)}
        style={styles.answers}
        accessible
        accessibilityLabel={[t('result.basedOn'), ...answers.map((a) => a.text)].join('. ')}>
        <Text variant="caption" tone="muted" bold center>
          {t('result.basedOn')}
        </Text>
        <View style={styles.chips}>
          {answers.map((a) => (
            <View
              key={a.key}
              style={[styles.answerChip, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <a.icon size={16} color={palette.textMuted} />
              <Text variant="label" style={{ flexShrink: 1 }} testID={`result-answer-${a.key}`}>
                {a.text}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={[styles.estimate, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}>
        <Info size={20} color={palette.accentInk} />
        <Text variant="label" bold tone="accent" style={{ flex: 1 }} testID="result-estimate">
          {t('result.estimate')}
        </Text>
      </View>

      <DraftBanner />

      {!incomeKnown ? (
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(motion.slow + 280)
                  .duration(motion.slow)
                  .easing(ease)
          }>
          <EmptyState
            illustration="shield"
            title={income?.kind === 'skip' ? t('result.skippedTitle') : t('result.missingTitle')}
            body={income?.kind === 'skip' ? t('result.skippedBody') : t('result.missingBody')}
            action={
              <Button variant="secondary" label={t('result.addIncome')} onPress={back} testID="result-add-income" />
            }
            testID="result-skipped"
          />
        </Animated.View>
      ) : null}

      {helpful.map((r, i) => (
        <Animated.View
          key={r.rule.id}
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(motion.slow + 280 + i * 60)
                  .duration(motion.slow)
                  .easing(ease)
          }
          style={styles.group}>
          <ResultCard result={r} householdSize={size} />
          <Notices programKey={r.rule.programKey} />
        </Animated.View>
      ))}

      {noneHelp ? (
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(motion.slow + 280)
                  .duration(motion.slow)
                  .easing(ease)
          }>
          <EmptyState
            illustration="bridge"
            title={t('result.standardTitle')}
            body={t('result.standardBody')}
            testID="result-standard"
          />
        </Animated.View>
      ) : null}

      {justOver.map((r) => (
        <Animated.View
          key={r.rule.id}
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(motion.slow + 320)
                  .duration(motion.slow)
                  .easing(ease)
          }
          style={styles.group}>
          <ResultCard result={r} householdSize={size} overLimit />
          <Notices programKey={r.rule.programKey} />
        </Animated.View>
      ))}

      {standard.map((r) => (
        <Animated.View
          key={r.rule.id}
          entering={
            reduceMotion
              ? undefined
              : FadeInDown.delay(motion.slow + 340)
                  .duration(motion.slow)
                  .easing(ease)
          }
          style={styles.group}>
          <ResultCard result={r} householdSize={size} showTier={r.tier !== 'notLikely'} />
          <Notices programKey={r.rule.programKey} />
        </Animated.View>
      ))}

      <Button
        variant="ghost"
        compact
        icon={RotateCcw}
        label={t('result.startOver')}
        onPress={startOver}
        style={{ alignSelf: 'center', marginTop: spacing.sm }}
        testID="result-start-over"
      />
    </Screen>
  );
}

function Notices({ programKey }: { programKey: string }) {
  const { t } = useTranslation('onboarding');
  const notices = noticesFor(programKey);
  if (notices.length === 0) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" bold tone="muted" accessibilityRole="header">
        {t('result.noticesTitle')}
      </Text>
      {notices.map((n) => (
        <NoticeBanner key={n.id} notice={n} />
      ))}
    </View>
  );
}

/** Confirmation inside the global sheet: Start over wipes answers and saved medicines. */
function StartOverConfirm() {
  const { t } = useTranslation('onboarding');
  const closeSheet = useUi((s) => s.closeSheet);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text>{t('result.startOverBody')}</Text>
      <Button
        variant="danger"
        label={t('result.startOverConfirm')}
        onPress={async () => {
          closeSheet();
          await wipePersonalData();
          router.replace(href(ROUTES.coverage));
        }}
        testID="result-start-over-confirm"
      />
      <Button
        variant="ghost"
        label={t('result.startOverCancel')}
        onPress={closeSheet}
        testID="result-start-over-cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  badgeWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  calmBadge: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  answers: { gap: spacing.xs, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  answerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  group: { gap: spacing.sm },
});
