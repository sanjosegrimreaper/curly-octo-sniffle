import { router, useLocalSearchParams } from 'expo-router';
import { Info, Tag } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { DrugNotFound } from '@/components/results/DrugNotFound';
import { asksPerDay, countText, daysLasting, medTitle } from '@/components/results/labels';
import { Odometer } from '@/components/results/Odometer';
import { MAX_QTY, PER_DAY_OPTIONS, resolveSelection, resultsHref, type RawSelectionParams } from '@/components/results/params';
import { SaveStar } from '@/components/results/SaveStar';
import { Reveal } from '@/components/results/Section';
import { CategoryChip, MarketBadge } from '@/components/search/MedBadges';
import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import type { Medication } from '@/data/schemas';
import { perDayCentsFromDaily, roundCents } from '@/domain';
import { Button, Card, Chip, HStack, minTap, radius, Screen, SourceChip, spacing, Text, typeScale, useTheme } from '@/design';
import { usePriceSummaries, usePriceSummary } from '@/hooks/usePrices';
import { formatMoney, formatNumber } from '@/i18n/format';
import { useMedicines, type Selection } from '@/state/medicines';

/** Strength & quantity: one decision, one primary button ("See prices"). */
export default function StrengthPickerScreen() {
  const params = useLocalSearchParams<RawSelectionParams & Record<string, string | string[]>>();
  const { id, strength, qty, perDay } = params;
  const lastSelection = useMedicines((s) => s.lastSelection);
  const resolved = useMemo(
    () => resolveSelection(getPack(), { id, strength, qty, perDay }, lastSelection),
    // The last selection only seeds the first render for this medicine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, strength, qty, perDay],
  );

  if (resolved.status !== 'ok') {
    return (
      <Screen back testID="picker-screen">
        <DrugNotFound />
      </Screen>
    );
  }
  const s = resolved.selection;
  return <Picker key={`${s.drugId}:${s.strengthId}:${s.quantity}:${s.perDay ?? ''}`} medication={resolved.medication} initial={s} />;
}

function Picker({ medication, initial }: { medication: Medication; initial: Selection }) {
  const { t } = useTranslation('results');
  const { palette, lang, textScale } = useTheme();
  const select = useMedicines((st) => st.select);

  const [strengthId, setStrengthId] = useState(initial.strengthId);
  const strength = medication.strengths.find((x) => x.id === strengthId) ?? medication.strengths[0]!;
  const [qty, setQty] = useState(initial.quantity);
  const [otherOpen, setOtherOpen] = useState(!strength.quantities.includes(initial.quantity));
  const [otherText, setOtherText] = useState(otherOpen ? String(initial.quantity) : '');
  const [perDay, setPerDay] = useState<number | null>(initial.perDay ?? null);

  const otherNumber = /^\d{1,3}$/.test(otherText.trim()) ? Number(otherText.trim()) : NaN;
  const otherValid = otherNumber >= 1 && otherNumber <= MAX_QTY;
  const quantity = otherOpen ? (otherValid ? otherNumber : null) : qty;
  const dailyAsked = asksPerDay(strength);
  const daily = dailyAsked ? perDay : null;

  const selection = useMemo<Selection | null>(
    () => (quantity ? { drugId: medication.id, strengthId: strength.id, quantity, perDay: daily } : null),
    [medication.id, strength.id, quantity, daily],
  );
  const summary = usePriceSummary(selection);
  const compareSels = useMemo<Selection[]>(
    () =>
      daily
        ? [30, 90].map((days) => ({ drugId: medication.id, strengthId: strength.id, quantity: days * daily, perDay: daily }))
        : [],
    [medication.id, strength.id, daily],
  );
  const compare = usePriceSummaries(compareSels);

  const title = medTitle(medication, lang);
  const days = quantity ? daysLasting(quantity, daily) : null;

  const pickStrength = (nextId: string) => {
    const next = medication.strengths.find((x) => x.id === nextId);
    if (!next) return;
    setStrengthId(next.id);
    if (!otherOpen && !next.quantities.includes(qty)) setQty(next.defaultQuantity);
  };

  const seePrices = () => {
    if (!selection) return;
    select(selection);
    router.push(resultsHref(selection));
  };

  // 30-vs-90: only when both are real Buy-now prices.
  const c30 = compare[0]?.lowest ?? null;
  const c90 = compare[1]?.lowest ?? null;
  const perDayText = (priceCents: number, q: number) => {
    const c = daily ? perDayCentsFromDaily(priceCents, q, daily) : null;
    return c === null ? null : formatMoney(roundCents(c), lang, { forceCents: true });
  };
  const day30 = c30 && daily ? perDayText(c30.priceCents, 30 * daily) : null;
  const day90 = c90 && daily ? perDayText(c90.priceCents, 90 * daily) : null;

  const lowest = summary?.lowest ?? null;
  const monthly = summary?.monthly[0] ?? null;
  const inputFont = typeScale.subheading.size * textScale;

  return (
    <Screen
      back
      right={selection ? <SaveStar selection={selection} summary={summary} /> : null}
      testID="picker-screen"
      footer={
        <Button
          label={t('picker.seePrices')}
          hint={t('picker.seePricesHint')}
          onPress={seePrices}
          disabled={!selection}
          testID="see-prices"
        />
      }>
      <Reveal index={0}>
        <View style={styles.head}>
          <Text variant="label" tone="accent" bold>
            {t('picker.eyebrow')}
          </Text>
          <Text variant="title" testID="picker-title">
            {loc(medication.displayName, lang)}
          </Text>
          {title.secondary ? (
            <Text tone="muted">
              <Text bold>{title.primary}</Text> · {title.secondary}
            </Text>
          ) : null}
          <HStack gap="xs">
            <MarketBadge status={medication.marketStatus} />
            <CategoryChip category={medication.category} />
          </HStack>
        </View>
        {medication.notes.map((note, i) => (
          <Card key={i} signal="sky" treatment="outline" style={styles.note}>
            <View style={styles.noteRow}>
              <Info size={20} color={palette.signals.sky.ink} />
              <Text variant="label" style={styles.flex}>
                {loc(note, lang)}
              </Text>
            </View>
            <SourceChip
              sources={medication.sources}
              verifiedAsOf={medication.verifiedAsOf}
              recordId={`medication:${medication.id}`}
              title={loc(medication.displayName, lang)}
            />
          </Card>
        ))}
      </Reveal>

      <Reveal index={1}>
        <View style={styles.group}>
          <Text variant="heading">{t('picker.strengthTitle')}</Text>
          <Text variant="label" tone="muted">
            {t('picker.strengthHint')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('picker.strengthTitle')} style={styles.chips}>
            {medication.strengths.map((st) => (
              <Chip
                key={st.id}
                label={loc(st.label, lang)}
                selected={st.id === strength.id}
                onPress={() => pickStrength(st.id)}
                testID={`strength-${st.id}`}
              />
            ))}
          </View>
        </View>
      </Reveal>

      <Reveal index={2}>
        <View style={styles.group}>
          <Text variant="heading">{t('picker.qtyTitle')}</Text>
          <Text variant="label" tone="muted">
            {t('picker.qtyHint')}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={t('picker.qtyTitle')} style={styles.chips}>
            {strength.quantities.map((q) => (
              <Chip
                key={q}
                label={countText(t, strength, q, lang)}
                selected={!otherOpen && q === qty}
                onPress={() => {
                  setOtherOpen(false);
                  setQty(q);
                }}
                testID={`qty-${q}`}
              />
            ))}
            <Chip label={t('picker.otherAmount')} selected={otherOpen} onPress={() => setOtherOpen(true)} testID="qty-other" />
          </View>
          {otherOpen ? (
            <View style={styles.group}>
              <Text variant="label" bold>
                {t('picker.otherLabel')}
              </Text>
              <TextInput
                testID="other-amount-input"
                value={otherText}
                onChangeText={(v) => setOtherText(v.replace(/[^\d]/g, '').slice(0, 3))}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                autoFocus={!otherText}
                accessibilityLabel={t('picker.otherLabel')}
                placeholder="60"
                placeholderTextColor={palette.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surfaceSunken,
                    borderColor: otherText && !otherValid ? palette.signals.coral.solid : palette.borderStrong,
                    color: palette.text,
                    fontSize: inputFont,
                  },
                ]}
              />
              {otherText && !otherValid ? (
                <Text variant="label" tone="coral" accessibilityLiveRegion="polite">
                  {t('picker.otherError')}
                </Text>
              ) : null}
            </View>
          ) : null}
          {days !== null && quantity && daily ? (
            <Text variant="label" bold tone="accent" accessibilityLiveRegion="polite" testID="days-helper">
              {t('picker.days', { count: days, qty: countText(t, strength, quantity, lang), perDay: formatNumber(daily, lang) })}
            </Text>
          ) : null}
        </View>
      </Reveal>

      {dailyAsked ? (
        <Reveal index={3}>
          <View style={styles.group}>
            <Text variant="heading">{t('picker.perDayTitle')}</Text>
            <Text variant="label" tone="muted">
              {t('picker.perDayHint')}
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={t('picker.perDayTitle')} style={styles.chips}>
              {PER_DAY_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={formatNumber(n, lang)}
                  accessibilityHint={t('perDayValue', { count: n })}
                  selected={perDay === n}
                  onPress={() => setPerDay(n)}
                  testID={`per-day-${n}`}
                />
              ))}
              <Chip label={t('picker.notSure')} selected={perDay === null} onPress={() => setPerDay(null)} testID="per-day-unsure" />
            </View>
          </View>
        </Reveal>
      ) : null}

      <Reveal index={4}>
        {lowest ? (
          <Card signal="mint" treatment="solid" testID="picker-preview">
            <HStack gap="xs">
              <Tag size={18} color={palette.signals.mint.ink} />
              <Text variant="label" bold tone="mint" style={styles.flex}>
                {t('picker.preview.title')}
              </Text>
            </HStack>
            <Odometer text={formatMoney(lowest.priceCents, lang)} variant="price" testID="picker-preview-price" />
            {lowest.priceKind === 'maximum' ? (
              <Text variant="label" bold tone="sunflower">
                {t('picker.preview.maximum')}
              </Text>
            ) : null}
            <Text variant="label" tone="muted">
              {t('picker.preview.from', { seller: lowest.seller })}
            </Text>
            {summary?.lowestPer30DaysCents != null ? (
              <Text bold tabular>
                {t('picker.preview.per30', { price: formatMoney(summary.lowestPer30DaysCents, lang) })}
              </Text>
            ) : null}
            {day30 && day90 ? (
              <Text variant="label" tabular testID="picker-compare">
                {t('picker.preview.compare', { price30: day30, price90: day90 })}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card testID="picker-preview-none">
            {monthly ? (
              <Text>
                {t('picker.preview.monthly', { seller: monthly.seller, price: formatMoney(monthly.priceCents, lang), per: monthly.per })}
              </Text>
            ) : null}
            <Text variant="label" tone="muted">
              {t('picker.preview.none')}
            </Text>
          </Card>
        )}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  note: { gap: spacing.xs },
  noteRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  flex: { flex: 1 },
  group: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { minHeight: minTap + 8, borderWidth: 2, borderRadius: radius.sm, paddingHorizontal: spacing.md, maxWidth: 220 },
});
