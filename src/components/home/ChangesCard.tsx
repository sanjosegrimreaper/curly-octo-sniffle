import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, SourceChip, spacing, Text, useTheme, VStack } from '@/design';
import { formatMoney } from '@/i18n/format';

import type { PriceChange } from './changes';
import { packageLabel, shortName } from './format';

/** "Changes since your last visit" — Buy-now prices only. Hidden when nothing changed. */
export function ChangesCard({ changes }: { changes: PriceChange[] }) {
  const { t } = useTranslation('plan');
  const { lang, palette } = useTheme();
  if (changes.length === 0) return null;
  return (
    <Card testID="plan-changes">
      <Text variant="heading">{t('changes.title')}</Text>
      <Text variant="label" tone="muted">
        {t('changes.note')}
      </Text>
      <VStack gap="sm" style={{ marginTop: spacing.xs }}>
        {changes.map((c) => {
          const lower = c.toCents < c.fromCents;
          const Icon = lower ? TrendingDown : TrendingUp;
          const signal = lower ? 'mint' : 'coral';
          const name = `${shortName(c.summary.medication, lang)} ${packageLabel(c.summary.strength, c.summary.quantity, lang)}`;
          return (
            <View key={c.key} style={[styles.row, { borderTopColor: palette.border }]}>
              <View style={[styles.icon, { backgroundColor: palette.signals[signal].tint }]}>
                <Icon size={20} color={palette.signals[signal].ink} />
              </View>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <Text>
                  {t('changes.priceChanged', {
                    name,
                    from: formatMoney(c.fromCents, lang),
                    to: formatMoney(c.toCents, lang),
                  })}
                </Text>
                <Badge label={lower ? t('changes.lower') : t('changes.higher')} signal={signal} icon={Icon} />
                <SourceChip
                  sources={c.option.sources}
                  verifiedAsOf={c.option.verifiedAsOf}
                  recordId={`price:${c.option.id}`}
                  title={name}
                />
              </View>
            </View>
          );
        })}
      </VStack>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingTop: spacing.sm, borderTopWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
