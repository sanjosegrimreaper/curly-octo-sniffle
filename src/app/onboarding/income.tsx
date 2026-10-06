import { router } from 'expo-router';
import { EyeOff, Keyboard, ListOrdered } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AmountField, parseAmount } from '@/components/onboarding/AmountField';
import { ChoiceCard, ChoiceGroup } from '@/components/onboarding/ChoiceCard';
import { IncomeLevelIcon } from '@/components/onboarding/IncomeLevelIcon';
import { bracketParts, incomeProximity, rangeKey } from '@/components/onboarding/income';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { getPack } from '@/data/pack';
import { Banner, Button, GlossaryChip, HStack, motion, Segmented, SourceChip, spacing, Text, useTheme } from '@/design';
import {
  bracketForIncome,
  buildBrackets,
  evaluateRules,
  fplYearRow,
  fromAnnual,
  latestYear,
  profileFromScreener,
  toAnnual,
  type Bracket,
} from '@/domain';
import { usePcts } from '@/hooks/useProfile';
import { formatDollars } from '@/i18n/format';
import { useScreener, type IncomeAnswer, type IncomeUnit } from '@/state/screener';

const ROUTE = ROUTES.income;

/** An amount as the person would type it ("2400" or "2400.50"). */
function amountText(n: number) {
  const cents = Math.round(n * 100);
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/**
 * Household income: brackets computed from the FPL table and the thresholds the pack actually
 * uses, in one label format ("Under $X a year" / "$X to $Y a year" / "Over $Y a year").
 * Or an exact amount, or "Prefer not to say".
 */
export default function IncomeScreen() {
  const { t } = useTranslation('onboarding');
  const { lang, reduceMotion } = useTheme();
  const screener = useScreener();
  const { incomeUnit: unit, income, householdSize, update } = screener;
  const pcts = usePcts();
  const pack = getPack();
  const fpl = pack.fpl;
  const year = latestYear(fpl);
  const yearRow = fplYearRow(fpl, year);
  const size = householdSize ?? 1;
  const brackets = useMemo(() => buildBrackets(fpl, year, size, pcts), [fpl, year, size, pcts]);

  const [exactOpen, setExactOpen] = useState(income?.kind === 'exact' || brackets.length === 0);
  const [exactText, setExactText] = useState(() =>
    income?.kind === 'exact' ? amountText(fromAnnual(income.annual, unit)) : '',
  );
  const exactAmount = parseAmount(exactText);
  const exactAnnual = exactAmount === null ? null : toAnnual(exactAmount, unit);
  const exactInvalid = exactText.trim() !== '' && exactAmount === null;

  // A bracket answer only counts for the household size and guideline year it was picked for.
  const selectedIndex =
    income?.kind === 'bracket' && income.householdSize === size && income.fplYear === year ? income.index : null;

  const other: IncomeUnit = unit === 'year' ? 'month' : 'year';
  const label = (b: Bracket, u: IncomeUnit) => {
    const p = bracketParts(b, u);
    const key = rangeKey(p, u);
    return t(`income.${key}`, {
      min: 'min' in p ? formatDollars(p.min, lang) : '',
      max: 'max' in p ? formatDollars(p.max, lang) : '',
    });
  };

  const exactBracket = exactAnnual === null ? null : bracketForIncome(fpl, year, size, pcts, exactAnnual);
  const exactBracketObj = exactBracket === null ? undefined : brackets[exactBracket];

  const proximity = useMemo(() => {
    if (exactAnnual === null) return { close: false, over: false };
    const answer: IncomeAnswer = { kind: 'exact', annual: exactAnnual };
    const profile = profileFromScreener({ ...screener, householdSize: size, income: answer }, fpl, pcts);
    return incomeProximity(evaluateRules(pack.benefits.rules, profile, fpl), fpl, size, exactAnnual);
  }, [exactAnnual, screener, size, fpl, pcts, pack.benefits.rules]);

  // Most people (and Medi-Cal) think in monthly income: start in Monthly until an income is given.
  // (The store's default unit is yearly — see "Requests for the lead".)
  useEffect(() => {
    if (useScreener.getState().income === null && useScreener.getState().incomeUnit !== 'month') {
      update({ incomeUnit: 'month' });
    }
  }, [update]);

  const setUnit = (u: IncomeUnit) => {
    if (exactOpen && exactAmount !== null) {
      update({ incomeUnit: u, income: { kind: 'exact', annual: toAnnual(exactAmount, u) } });
    } else update({ incomeUnit: u });
  };

  const onExact = (text: string) => {
    setExactText(text);
    const a = parseAmount(text);
    if (a !== null) update({ householdSize: size, income: { kind: 'exact', annual: toAnnual(a, unit) } });
  };

  const pick = (index: number) => {
    update({ householdSize: size, income: { kind: 'bracket', index, householdSize: size, fplYear: year } });
  };

  const canContinue = exactOpen ? exactAnnual !== null : selectedIndex !== null;
  const next = () => {
    if (!canContinue) return;
    if (exactOpen && exactAnnual !== null) update({ householdSize: size, income: { kind: 'exact', annual: exactAnnual } });
    router.push(href(ROUTES.result));
  };

  const skip = () => {
    update({ income: { kind: 'skip' } });
    router.push(href(ROUTES.result));
  };

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-income"
      title={unit === 'year' ? t('income.title_year') : t('income.title_month')}
      subtitle={unit === 'year' ? t('income.body_year') : t('income.body_month')}
      footer={
        <Button
          label={t('income.seeEstimate')}
          hint={canContinue ? undefined : t('chooseOne')}
          onPress={next}
          disabled={!canContinue}
          testID="income-next"
        />
      }>
      <Segmented<IncomeUnit>
        accessibilityLabel={t('income.unitLabel')}
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'month', label: t('income.monthly'), testID: 'income-unit-month' },
          { value: 'year', label: t('income.yearly'), testID: 'income-unit-year' },
        ]}
      />

      {!exactOpen ? (
        <ChoiceGroup label={t('income.groupLabel')}>
          {brackets.map((b, i) => (
            <ChoiceCard
              key={`${size}-${b.index}`}
              index={i}
              title={label(b, unit)}
              subtitle={label(b, other)}
              leading={<IncomeLevelIcon level={b.index} of={brackets.length} selected={selectedIndex === b.index} />}
              selected={selectedIndex === b.index}
              onPress={() => pick(b.index)}
              testID={`income-bracket-${b.index}`}
            />
          ))}
        </ChoiceGroup>
      ) : (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} style={{ gap: spacing.sm }}>
          {brackets.length === 0 ? <Banner tone="info" title={t('income.noBrackets')} /> : null}
          <AmountField
            label={unit === 'year' ? t('income.exactLabel_year') : t('income.exactLabel_month')}
            prefix="$"
            value={exactText}
            onChangeText={onExact}
            placeholder="0"
            hint={t('income.exactHint')}
            error={exactInvalid ? t('income.exactInvalid') : null}
            testID="income-exact"
          />
          {exactBracketObj ? (
            <Text variant="label" tone="muted" testID="income-exact-range">
              {t('income.exactInRange', { range: label(exactBracketObj, unit) })}
            </Text>
          ) : null}
          {proximity.over || proximity.close ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
              {proximity.over ? (
                <Banner tone="caution" title={t('income.overLimitTitle')} body={t('income.overLimitBody')} testID="income-over-limit" />
              ) : (
                <Banner tone="caution" title={t('income.nearLimitTitle')} body={t('income.nearLimitBody')} testID="income-near-limit" />
              )}
            </Animated.View>
          ) : null}
        </Animated.View>
      )}

      {brackets.length > 0 ? (
        <Button
          variant="secondary"
          icon={exactOpen ? ListOrdered : Keyboard}
          label={exactOpen ? t('income.hideExact') : t('income.typeExact')}
          onPress={() => setExactOpen((v) => !v)}
          testID="income-toggle-exact"
        />
      ) : null}

      {yearRow ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" tone="muted" testID="income-fpl-note">
            {t('income.fplNote', { count: size, year })}
          </Text>
          <SourceChip
            sources={yearRow.sources}
            verifiedAsOf={yearRow.verifiedAsOf}
            recordId={`fpl:${year}`}
            title={t('income.fplSource', { year })}
          />
        </View>
      ) : null}

      <HStack gap="xs">
        <GlossaryChip termId="income" label={t('income.whatCounts')} />
        <GlossaryChip termId="fpl" label={t('income.whatIsFpl')} />
      </HStack>

      <Button
        variant="ghost"
        compact
        icon={EyeOff}
        label={t('income.skip')}
        hint={t('income.skipHint')}
        onPress={skip}
        style={{ alignSelf: 'center' }}
        testID="income-skip"
      />
    </ScreenerScreen>
  );
}
