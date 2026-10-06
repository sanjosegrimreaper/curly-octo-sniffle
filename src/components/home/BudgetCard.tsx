import { Calculator, ChevronDown, ChevronUp, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Card, minTap, motion, spacing, Tappable, Text, useTheme } from '@/design';
import { formatMoney } from '@/i18n/format';

import type { BudgetView } from './budgetView';
import { shortName } from './format';

/**
 * Monthly budget: verified Buy-now prices only, never estimates. Says exactly what is
 * counted, what is not and why, and shows the math one tap away.
 */
export function BudgetCard({ view }: { view: BudgetView }) {
  const { t } = useTranslation('medicines');
  const { palette, lang, reduceMotion } = useTheme();
  const [open, setOpen] = useState(false);
  const hasTotal = view.known > 0;
  const mint = palette.signals.mint;
  const counted = view.lines.filter((l) => l.reason === 'counted');

  return (
    <Card signal={hasTotal ? 'mint' : undefined} treatment={hasTotal ? 'solid' : 'plain'} testID="budget-card">
      <View style={styles.head}>
        <Wallet size={20} color={hasTotal ? mint.ink : palette.textMuted} />
        <Text variant="label" bold style={{ color: hasTotal ? mint.ink : palette.textMuted }}>
          {t('budget.label')}
        </Text>
      </View>
      {hasTotal ? (
        <>
          <Text variant="price" style={{ color: mint.ink }} testID="budget-total">
            {t('budget.perMonth', { price: formatMoney(view.monthlyCents, lang) })}
          </Text>
          <Text variant="subheading">{t('budget.forCount', { count: view.known })}</Text>
        </>
      ) : (
        <Text variant="heading" testID="budget-none">
          {t('budget.noneYet')}
        </Text>
      )}
      {view.noPrice > 0 ? (
        <Text variant="label" testID="budget-no-price">
          {t('budget.noPrice', { count: view.noPrice })}
        </Text>
      ) : null}
      {view.needDays > 0 ? (
        <Text variant="label" testID="budget-need-days">
          {t('budget.needDays', { count: view.needDays })}
        </Text>
      ) : null}
      <Text variant="label" tone="muted">
        {t('budget.explain')}
      </Text>
      {counted.length > 0 ? (
        <>
          <Tappable
            testID="budget-math"
            onPress={() => setOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? t('budget.hideMath') : t('budget.showMath')}
            style={styles.toggle}>
            <Calculator size={18} color={palette.accentInk} />
            <Text variant="label" bold tone="accent">
              {open ? t('budget.hideMath') : t('budget.showMath')}
            </Text>
            {open ? <ChevronUp size={18} color={palette.accentInk} /> : <ChevronDown size={18} color={palette.accentInk} />}
          </Tappable>
          {open ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}
              style={[styles.math, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {counted.map((l) =>
                l.option && l.summary && l.days !== null && l.monthlyCents !== null ? (
                  <Text key={l.key} variant="label" tabular>
                    {t('budget.mathLine', {
                      name: shortName(l.summary.medication, lang),
                      price: formatMoney(l.option.priceCents, lang),
                      days: l.days,
                      monthly: formatMoney(l.monthlyCents, lang),
                    })}
                  </Text>
                ) : null,
              )}
              <Text variant="label" bold tabular>
                {t('budget.mathTotal', { total: formatMoney(view.monthlyCents, lang) })}
              </Text>
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: minTap, alignSelf: 'flex-start' },
  math: { borderWidth: 1, borderRadius: 12, padding: spacing.sm, gap: spacing.xxs },
});
