import { Calculator, Info, RotateCcw, ShoppingBag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { BuyNowOption } from '@/data/prices';
import type { CostPlusSnapshot, Strength } from '@/data/schemas';
import { per30DaysCentsFromDaily } from '@/domain';
import { Button, Card, SourceChip, spacing, Tappable, Text, useTheme } from '@/design';
import { formatDate, formatMoney, formatNumber, formatUnitPrice } from '@/i18n/format';
import type { Lang } from '@/i18n/languages';
import { openExternal } from '@/services/links';

import { FlipCard } from './FlipCard';
import { asksPerDay, countText, daysLasting, eachDollars, type ResultsT } from './labels';
import { Odometer } from './Odometer';

type Props = {
  option: BuyNowOption;
  strength: Strength;
  perDay: number | null;
  /** The Cost Plus formula (fees from data) — shown on Cost Plus quotes. */
  formula: CostPlusSnapshot['formula'];
};

/** "60 tablets" for a fixed quantity, or the pack's "30-day supply" for monthly prices. */
export function packageText(t: ResultsT, option: BuyNowOption, strength: Strength, lang: Lang): string {
  if (option.per) return option.per;
  if (option.quantity !== null) return countText(t, strength, option.quantity, lang);
  return '';
}

export function formulaText(t: ResultsT, formula: CostPlusSnapshot['formula'], lang: Lang): string {
  return t('buyNow.formula', { markup: formatNumber(formula.markupPercent, lang), fee: formatMoney(formula.pharmacyFeeCents, lang) });
}

/** Arithmetic lines for the back of a Buy-now card. Every number comes from the pack or the domain math. */
export function mathLines(t: ResultsT, option: BuyNowOption, strength: Strength, perDay: number | null, lang: Lang): string[] {
  const price = formatMoney(option.priceCents, lang);
  const lines: string[] = [];
  if (option.quantity === null) {
    lines.push(t('ladder.perPeriod', { price, per: option.per }));
    lines.push(t('buyNow.mathMonthly', { per: option.per }));
  } else {
    const qty = countText(t, strength, option.quantity, lang);
    lines.push(t('buyNow.mathPrice', { price, qty }));
    const each = eachDollars(option.priceCents, option.quantity);
    if (each !== null && option.quantity > 1) {
      lines.push(t('buyNow.mathEach', { price, count: formatNumber(option.quantity, lang), each: formatUnitPrice(each, lang) }));
    }
    const days = daysLasting(option.quantity, perDay);
    const per30 = per30DaysCentsFromDaily(option.priceCents, option.quantity, perDay ?? null);
    if (perDay && days !== null && per30 !== null && each !== null) {
      lines.push(t('buyNow.mathDays', { count: days, perDay: formatNumber(perDay, lang), qty }));
      lines.push(t('buyNow.math30', { each: formatUnitPrice(each, lang), perDay: formatNumber(perDay, lang), total: formatMoney(per30, lang) }));
    } else if (asksPerDay(strength)) {
      lines.push(t('buyNow.mathAskPerDay'));
    }
  }
  if (option.priceKind === 'maximum') lines.push(t('buyNow.mathMaximum'));
  return lines;
}

/**
 * One Buy-now option (a real checkout price): solid mint card, label → big price →
 * package → note → source chip. Tapping the price flips it to show the math.
 */
export function BuyNowCard({ option, strength, perDay, formula }: Props) {
  const { t } = useTranslation('results');
  const { palette, lang } = useTheme();
  const mint = palette.signals.mint;
  const price = formatMoney(option.priceCents, lang);
  const pkg = packageText(t, option, strength, lang);
  const isCostPlus = option.source === 'costPlus';

  const front = (flip: () => void) => (
    <Card signal="mint" treatment="solid" testID={`buy-now-${option.id}`} style={styles.card}>
      <View style={styles.labelRow}>
        <ShoppingBag size={18} color={mint.ink} />
        <Text variant="label" bold tone="mint" style={styles.flex}>
          {t('buyNow.label', { seller: option.seller })}
        </Text>
      </View>

      <Tappable
        feedback="tick"
        onPress={flip}
        accessibilityLabel={`${option.priceKind === 'maximum' ? `${t('buyNow.upTo')} ` : ''}${price}, ${pkg}`}
        accessibilityHint={t('buyNow.flipHint')}
        style={styles.priceBlock}>
        {option.priceKind === 'maximum' ? (
          <Text variant="label" bold tone="mint">
            {t('buyNow.upTo')}
          </Text>
        ) : null}
        <Odometer text={price} variant="price" testID={`buy-now-price-${option.id}`} />
        {pkg ? (
          <Text variant="subheading" tone="muted">
            {pkg}
          </Text>
        ) : null}
      </Tappable>

      {option.priceKind === 'maximum' ? (
        <View style={styles.noteRow}>
          <Info size={18} color={palette.signals.sunflower.ink} />
          <Text variant="label" bold tone="sunflower" style={styles.flex}>
            {t('buyNow.maximum')}
          </Text>
        </View>
      ) : null}
      {option.eligibility ? <Text variant="label">{option.eligibility}</Text> : null}
      {option.description && option.description !== pkg ? (
        <Text variant="label" tone="muted">
          {option.description}
        </Text>
      ) : null}

      {isCostPlus ? (
        <View style={[styles.formula, { borderColor: mint.solid }]}>
          <Text variant="label">{formulaText(t, formula, lang)}</Text>
          {option.snapshotDate ? (
            <Text variant="caption" tone="muted">
              {t('buyNow.snapshot', { date: formatDate(option.snapshotDate, lang) })}
            </Text>
          ) : null}
          <SourceChip sources={formula.sources} verifiedAsOf={formula.verifiedAsOf} recordId="costplus:formula" title={t('costPlus.title')} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="ghost"
          compact
          icon={Calculator}
          label={t('buyNow.showMath')}
          onPress={flip}
          testID={`show-math-${option.id}`}
          style={styles.mathButton}
        />
        <Button
          variant="secondary"
          compact
          external
          label={t('buyNow.open', { seller: option.seller })}
          onPress={() => void openExternal(option.url)}
          testID={`open-seller-${option.id}`}
        />
      </View>
      <SourceChip sources={option.sources} verifiedAsOf={option.verifiedAsOf} recordId={`price:${option.id}`} title={option.seller} />
    </Card>
  );

  const back = (flip: () => void) => (
    <Card signal="mint" treatment="solid" testID={`buy-now-math-${option.id}`} style={styles.card}>
      <View style={styles.labelRow}>
        <Calculator size={18} color={mint.ink} />
        <Text variant="label" bold tone="mint" style={styles.flex}>
          {t('buyNow.mathTitle')} · {option.seller}
        </Text>
      </View>
      <View style={[styles.mathBox, { backgroundColor: palette.surface, borderColor: mint.solid }]}>
        {mathLines(t, option, strength, perDay, lang).map((line, i) => (
          <Text key={i} variant={i === 0 ? 'subheading' : 'body'} tabular>
            {line}
          </Text>
        ))}
        {isCostPlus ? <Text variant="label">{formulaText(t, formula, lang)}</Text> : null}
      </View>
      {isCostPlus ? (
        <SourceChip sources={formula.sources} verifiedAsOf={formula.verifiedAsOf} recordId="costplus:formula" title={t('costPlus.title')} />
      ) : null}
      <Button variant="ghost" compact icon={RotateCcw} label={t('buyNow.showPrice')} onPress={flip} testID={`show-price-${option.id}`} style={styles.mathButton} />
      <SourceChip sources={option.sources} verifiedAsOf={option.verifiedAsOf} recordId={`price:${option.id}`} title={option.seller} />
    </Card>
  );

  return <FlipCard front={front} back={back} testID={`flip-${option.id}`} />;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  priceBlock: { alignSelf: 'flex-start', gap: 2, paddingVertical: spacing.xxs, borderRadius: 12 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  formula: { gap: spacing.xs, borderLeftWidth: 3, paddingLeft: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  mathButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm },
  mathBox: { gap: spacing.xs, padding: spacing.md, borderRadius: 16, borderWidth: 1 },
});
