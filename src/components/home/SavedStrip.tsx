import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import type { PriceSummary } from '@/data/prices';
import { minTap, motion, radius, SourceChip, spacing, Tappable, Text, useTheme } from '@/design';
import { formatMoney } from '@/i18n/format';
import type { SavedMedicine } from '@/state/medicines';

import { packageLabel, resultsHref, shortName } from './format';

const CARD_WIDTH = 232;

/** Saved medicines as a horizontal strip, each with its lowest Buy-now price (or "No price loaded yet"). */
export function SavedStrip({ saved, summaries }: { saved: SavedMedicine[]; summaries: (PriceSummary | null)[] }) {
  const { t } = useTranslation('plan');
  const { palette, lang, reduceMotion, highContrast, textScale } = useTheme();
  const width = Math.round(CARD_WIDTH * Math.min(textScale, 1.3));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={styles.scroller}
      accessibilityRole="list">
      {saved.map((m, i) => {
        const summary = summaries[i];
        if (!summary) return null;
        const lowest = summary.lowest;
        const name = shortName(summary.medication, lang);
        const pkg = packageLabel(summary.strength, m.quantity, lang);
        const money = lowest ? formatMoney(lowest.priceCents, lang) : null;
        const priceText = lowest && money ? (lowest.priceKind === 'maximum' ? t('saved.upTo', { price: money }) : money) : null;
        const mint = palette.signals.mint;
        return (
          <Animated.View
            key={m.key}
            entering={reduceMotion ? undefined : FadeInRight.delay(i * 40).duration(motion.slow)}
            style={[
              styles.card,
              {
                width,
                backgroundColor: lowest ? mint.tint : palette.surface,
                borderColor: lowest ? mint.solid : palette.border,
                borderWidth: highContrast || lowest ? 2 : 1,
                shadowColor: palette.shadow,
              },
            ]}>
            <Tappable
              testID={`saved-${m.drugId}`}
              onPress={() => router.push(resultsHref(m))}
              accessibilityLabel={[name, pkg, priceText ?? t('saved.noPrice')].join('. ')}
              accessibilityHint={t('saved.open', { name })}
              style={styles.tap}>
              <Text variant="subheading">
                {name}
              </Text>
              <Text variant="caption" tone="muted">
                {pkg}
              </Text>
              {lowest && priceText ? (
                <View style={{ gap: 2, marginTop: spacing.xxs }}>
                  <Text variant="caption" bold tone="mint">
                    {t('saved.lowest')}
                  </Text>
                  <Text variant="priceSmall" style={{ color: mint.ink }}>
                    {priceText}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {lowest.seller}
                  </Text>
                </View>
              ) : (
                <Text variant="label" tone="muted" style={{ marginTop: spacing.xxs }}>
                  {t('saved.noPrice')}
                </Text>
              )}
            </Tappable>
            {lowest ? (
              <View style={styles.chip}>
                <SourceChip sources={lowest.sources} verifiedAsOf={lowest.verifiedAsOf} recordId={`price:${lowest.id}`} title={name} />
              </View>
            ) : null}
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: { marginHorizontal: -spacing.md },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xxs, alignItems: 'stretch' },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  tap: { padding: spacing.md, gap: spacing.xxs, minHeight: minTap, flexGrow: 1 },
  chip: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
});
