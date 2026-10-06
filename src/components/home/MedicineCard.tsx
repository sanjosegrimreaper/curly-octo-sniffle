import { router, type Href } from 'expo-router';
import { Bell, BellRing, HandHeart, Hourglass, Search, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { getPack } from '@/data/pack';
import type { PriceSummary } from '@/data/prices';
import { Badge, Button, Card, Chip, HStack, radius, SourceChip, spacing, Text, useTheme, VStack } from '@/design';
import { formatMoney } from '@/i18n/format';
import type { SavedMedicine } from '@/state/medicines';
import { useUi } from '@/state/ui';

import { fillDays } from './budgetView';
import { confirmAction } from './confirm';
import { medicineName, packageLabel, resultsHref, shortName } from './format';
import { removeMedicine, setFillDays, turnOffRefill, turnOnRefill } from './medicineActions';

const isWeb = Platform.OS === 'web';

export const FILL_DAY_CHOICES = [30, 60, 90] as const;

/** True when a program in the pack covers this medicine and still takes new patients. */
export function hasOpenProgram(medicationId: string): boolean {
  return getPack().programs.some((p) => p.medicationIds.includes(medicationId) && !p.closedToNew);
}

/** One saved medicine: lowest Buy-now price (or an honest "not loaded"), badges and actions. */
export function MedicineCard({ medicine, summary }: { medicine: SavedMedicine; summary: PriceSummary | null }) {
  const { t } = useTranslation('medicines');
  const { palette, lang } = useTheme();

  if (!summary) {
    // The medicine or strength is no longer in this data version: never drop it silently.
    return <MissingMedicineCard medicine={medicine} />;
  }

  const name = medicineName(summary.medication, lang);
  const brand = shortName(summary.medication, lang);
  const pkg = packageLabel(summary.strength, medicine.quantity, lang);
  const lowest = summary.lowest;
  const days = fillDays(medicine, summary);
  const genericYear = genericYearOf(summary);
  const program = hasOpenProgram(summary.medication.id);
  const money = lowest ? formatMoney(lowest.priceCents, lang) : null;
  const mint = palette.signals.mint;

  const askRefill = () =>
    useUi.getState().openSheet({
      kind: 'custom',
      title: t('refill.sheetTitle'),
      render: () => <RefillChooser medicine={medicine} name={brand} />,
    });

  return (
    <Card testID={`medicine-${medicine.key}`}>
      <Text variant="heading">{name}</Text>
      <Text variant="label" tone="muted">
        {pkg}
      </Text>
      {genericYear || program ? (
        <HStack gap="xs">
          {genericYear ? <Badge label={t('card.genericMayCome', { year: genericYear })} signal="tangerine" icon={Hourglass} /> : null}
          {program ? <Badge label={t('card.hasProgram')} signal="lilac" icon={HandHeart} /> : null}
        </HStack>
      ) : null}

      {lowest && money ? (
        <Card signal="mint" treatment="solid" style={{ marginTop: spacing.xs }} testID={`medicine-price-${medicine.key}`}>
          <Text variant="label" bold tone="mint">
            {t('card.lowestLabel')}
          </Text>
          <Text variant="price" style={{ color: mint.ink }}>
            {lowest.priceKind === 'maximum' ? t('card.upTo', { price: money }) : money}
          </Text>
          <Text variant="label">{pkg}</Text>
          <Text variant="label" tone="muted">
            {t('card.at', { seller: lowest.seller })}
          </Text>
          {lowest.priceKind === 'maximum' ? (
            <Text variant="caption" tone="muted">
              {t('card.maxNote')}
            </Text>
          ) : null}
          {summary.lowestPer30DaysCents !== null ? (
            <Text variant="label" bold tabular>
              {t('card.per30', { price: formatMoney(summary.lowestPer30DaysCents, lang) })}
            </Text>
          ) : null}
          <SourceChip sources={lowest.sources} verifiedAsOf={lowest.verifiedAsOf} recordId={`price:${lowest.id}`} title={name} />
        </Card>
      ) : (
        <View
          testID={`medicine-noprice-${medicine.key}`}
          style={[styles.noPrice, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
          <Text bold>{t('card.noPrice')}</Text>
          <Text variant="label" tone="muted">
            {t('card.noPriceBody')}
          </Text>
        </View>
      )}

      <VStack gap="xs" style={{ marginTop: spacing.xs }}>
        <Text variant="label" bold>
          {t('card.lastsQuestion')}
        </Text>
        <HStack gap="xs">
          {FILL_DAY_CHOICES.map((d) => (
            <Chip
              key={d}
              testID={`fill-${medicine.key}-${d}`}
              label={t('card.days', { count: d })}
              selected={days === d}
              onPress={() => setFillDays(medicine.key, days === d ? null : d)}
            />
          ))}
          {days !== null && !FILL_DAY_CHOICES.includes(days as (typeof FILL_DAY_CHOICES)[number]) ? (
            <Chip label={t('card.days', { count: days })} selected onPress={() => setFillDays(medicine.key, null)} />
          ) : null}
        </HStack>
        {days === null ? (
          <Text variant="caption" tone="muted">
            {t('card.lastsHint')}
          </Text>
        ) : null}
      </VStack>

      <HStack gap="xs" style={{ marginTop: spacing.sm }}>
        <Button
          compact
          variant="secondary"
          label={t('card.open', { name: brand })}
          onPress={() => router.push(resultsHref(medicine))}
          testID={`medicine-open-${medicine.key}`}
        />
        {isWeb ? null : medicine.refill ? (
          <Button
            compact
            variant="secondary"
            icon={BellRing}
            label={t('card.remindOn', { count: medicine.refill.everyDays })}
            hint={t('card.remindOff')}
            onPress={() => void turnOffRefill(medicine)}
            testID={`medicine-refill-${medicine.key}`}
          />
        ) : (
          <Button
            compact
            variant="secondary"
            icon={Bell}
            label={t('card.remind')}
            onPress={() => (days !== null ? void turnOnRefill(medicine, days, brand) : askRefill())}
            testID={`medicine-refill-${medicine.key}`}
          />
        )}
        <RemoveButton medicine={medicine} name={brand} />
      </HStack>
      {isWeb ? (
        <Text variant="caption" tone="muted">
          {t('card.remindWeb')}
        </Text>
      ) : null}
    </Card>
  );
}

/** A saved medicine or strength that is no longer in the pack: say so, offer Search and Remove. */
export function MissingMedicineCard({ medicine }: { medicine: SavedMedicine }) {
  const { t } = useTranslation('medicines');
  return (
    <Card signal="sunflower" treatment="dashed" testID={`medicine-missing-${medicine.key}`}>
      <Text variant="subheading">{t('card.missing')}</Text>
      <Text variant="label" tone="muted">
        {medicine.drugId} · {medicine.strengthId} × {medicine.quantity}
      </Text>
      <Text variant="label">{t('card.missingBody')}</Text>
      <HStack gap="xs" style={{ marginTop: spacing.xs }}>
        <Button
          compact
          icon={Search}
          label={t('card.missingSearch')}
          onPress={() => router.push('/find' as Href)}
          testID={`medicine-missing-search-${medicine.key}`}
        />
        <RemoveButton medicine={medicine} name={medicine.drugId} />
      </HStack>
    </Card>
  );
}

/** "2028" when a generic may come within about 3 years (outlook tiers within12 / oneToThree), else null. */
export function genericYearOf(summary: PriceSummary): string | null {
  if (summary.outlook.tier !== 'within12' && summary.outlook.tier !== 'oneToThree') return null;
  const o = getPack().outlooks.find((x) => x.medicationId === summary.medication.id);
  return o?.earliestDate ? o.earliestDate.slice(0, 4) : null;
}

function RemoveButton({ medicine, name }: { medicine: SavedMedicine; name: string }) {
  const { t } = useTranslation('medicines');
  return (
    <Button
      compact
      variant="ghost"
      icon={Trash2}
      label={t('card.remove', { name })}
      testID={`medicine-remove-${medicine.key}`}
      onPress={() =>
        confirmAction({
          title: t('remove.title', { name }),
          body: t('remove.body'),
          confirmLabel: t('remove.confirm'),
          danger: true,
          onConfirm: async () => {
            await removeMedicine(medicine);
            useUi.getState().showToast(t('remove.done', { name }), 'success');
          },
        })
      }
    />
  );
}

/** Refill sheet: how long one fill lasts (30 / 60 / 90 days), then schedule. */
function RefillChooser({ medicine, name }: { medicine: SavedMedicine; name: string }) {
  const { t } = useTranslation('medicines');
  const close = useUi((s) => s.closeSheet);
  return (
    <VStack gap="md">
      <Text>{t('refill.sheetBody')}</Text>
      <HStack gap="xs">
        {FILL_DAY_CHOICES.map((d) => (
          <Chip
            key={d}
            testID={`refill-every-${d}`}
            label={t('refill.every', { count: d })}
            onPress={() => {
              close();
              setFillDays(medicine.key, d);
              void turnOnRefill(medicine, d, name);
            }}
          />
        ))}
      </HStack>
      <Text variant="caption" tone="muted">
        {t('refill.privacy')}
      </Text>
    </VStack>
  );
}

const styles = StyleSheet.create({
  noPrice: { marginTop: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', padding: spacing.sm, gap: 2 },
});
