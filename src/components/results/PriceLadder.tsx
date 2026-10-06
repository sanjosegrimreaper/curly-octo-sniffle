import { BadgeCheck, ExternalLink, Info, Ticket } from 'lucide-react-native';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import type { PriceSummary } from '@/data/prices';
import { Card, Illustration, motion, radius, spacing, Tappable, Text, useTheme } from '@/design';
import { formatDate, formatMoney } from '@/i18n/format';
import type { Lang } from '@/i18n/languages';
import { openExternal } from '@/services/links';

import { Odometer } from './Odometer';
import type { ResultsT } from './labels';

const BAR_H = 22;
const BAR_STAGGER = 110;

export type LadderModel = {
  buys: { id: string; seller: string; priceCents: number; priceKind: 'fixed' | 'maximum'; lowest: boolean }[];
  /**
   * The "lowest listed" ribbon, only when it is a fair comparison: two or more options for the
   * same product (never for biologics, whose options are different products) and the lowest
   * price is strictly lower than the next one (a tie gets no ribbon).
   */
  ribbon: { id: string; date: string } | null;
  /** Options are different versions of the medicine (biologics): never ranked against each other. */
  versions: boolean;
  reference: { totalCents: number } | null;
  coupons: { site: 'GoodRx' | 'SingleCare'; url: string }[];
  monthly: { id: string; seller: string; priceCents: number; per: string }[];
};

/** Everything the ladder shows, straight from the price summary (no estimates). */
export function ladderModel(summary: PriceSummary): LadderModel {
  const versions = summary.medication.kind === 'biologic';
  const [first, second] = summary.comparable;
  const ribbon =
    !versions && first && second && first.priceCents < second.priceCents
      ? { id: first.id, date: first.snapshotDate ?? first.verifiedAsOf }
      : null;
  const buys = summary.comparable.map((o) => ({
    id: o.id,
    seller: o.seller,
    priceCents: o.priceCents,
    priceKind: o.priceKind,
    lowest: ribbon?.id === o.id,
  }));
  const coupons: LadderModel['coupons'] = [];
  if (summary.coupons.goodRxUrl) coupons.push({ site: 'GoodRx', url: summary.coupons.goodRxUrl });
  if (summary.coupons.singleCareUrl) coupons.push({ site: 'SingleCare', url: summary.coupons.singleCareUrl });
  return {
    buys,
    ribbon,
    versions,
    reference: summary.nadacFeedLoaded && summary.nadac ? { totalCents: summary.nadac.total.totalCents } : null,
    coupons,
    monthly: summary.monthly.map((o) => ({ id: o.id, seller: o.seller, priceCents: o.priceCents, per: o.per })),
  };
}

const priceText = (t: ResultsT, cents: number, kind: 'fixed' | 'maximum', lang: Lang) =>
  kind === 'maximum' ? t('ladder.upTo', { price: formatMoney(cents, lang) }) : formatMoney(cents, lang);

/** The whole chart as one sentence list, for screen readers. */
export function ladderA11yLabel(model: LadderModel, t: ResultsT, lang: Lang, selection: string): string {
  const parts = [t('ladder.a11yIntro', { selection })];
  if (model.buys.length === 0 && model.monthly.length === 0) parts.push(t('ladder.a11yEmpty'));
  for (const b of model.buys) {
    parts.push(t('ladder.a11yBuy', { seller: b.seller, price: priceText(t, b.priceCents, b.priceKind, lang) }));
    if (b.lowest && model.ribbon) parts.push(t('ladder.ribbon', { date: formatDate(model.ribbon.date, lang) }));
  }
  if (model.reference) parts.push(t('ladder.a11yReference', { price: formatMoney(model.reference.totalCents, lang) }));
  for (const m of model.monthly) {
    parts.push(t('ladder.a11yMonthly', { seller: m.seller, price: formatMoney(m.priceCents, lang), per: m.per }));
  }
  for (const c of model.coupons) parts.push(t('ladder.a11yCoupon', { site: c.site }));
  if (model.versions && model.buys.length + model.monthly.length > 1) parts.push(t('ladder.versions'));
  return parts.join(' ');
}

/**
 * Price Ladder: every Buy-now option on one shared scale. Mint bars grow in sequence,
 * the NADAC reference is a hatched slate bar, coupon sites get no bar (we never know
 * their amount), and monthly programs are listed apart because they are priced per month.
 * Screen readers get the whole chart as one text label and can swipe past it.
 */
export function PriceLadder({ summary, selection }: { summary: PriceSummary; selection: string }) {
  const { t } = useTranslation('results');
  const { palette, lang } = useTheme();
  const model = ladderModel(summary);
  const max = Math.max(1, ...model.buys.map((b) => b.priceCents), model.reference?.totalCents ?? 0);
  const empty = model.buys.length === 0 && model.monthly.length === 0;

  return (
    <Card testID="price-ladder">
      <View accessible accessibilityLabel={ladderA11yLabel(model, t, lang, selection)} style={styles.body}>
        <View style={styles.headText}>
          <Text variant="heading">{t('ladder.title')}</Text>
          <Text variant="label" tone="muted">
            {t('ladder.subtitle', { selection })}
          </Text>
        </View>

        {model.versions && model.buys.length + model.monthly.length > 1 ? (
          <View style={styles.versions} testID="ladder-versions">
            <Info size={18} color={palette.signals.sky.ink} />
            <Text variant="label" bold style={styles.flexText}>
              {t('ladder.versions')}
            </Text>
          </View>
        ) : null}

        {empty ? (
          <View style={[styles.empty, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]} testID="ladder-empty">
            <Illustration name="pillBottle" size={72} />
            <Text variant="subheading" center>
              {t('ladder.emptyTitle')}
            </Text>
            <Text variant="label" tone="muted" center>
              {t('ladder.emptyBody')}
            </Text>
          </View>
        ) : null}

        {model.buys.length === 0 && model.monthly.length > 0 ? (
          <Text variant="label" tone="muted">
            {t('ladder.noExact')}
          </Text>
        ) : null}

        {model.buys.map((b, i) => (
          <View key={b.id} style={styles.row} testID={`ladder-buy-${b.id}`}>
            {b.lowest && model.ribbon ? (
              <Ribbon label={t('ladder.ribbon', { date: formatDate(model.ribbon.date, lang) })} delay={(i + 1) * BAR_STAGGER + motion.slow} />
            ) : null}
            <View style={styles.labelRow}>
              <Text variant="label" bold style={styles.flexText}>
                {b.seller}
              </Text>
              <View style={styles.priceWrap}>
                {b.priceKind === 'maximum' ? (
                  <Text variant="caption" tone="muted">
                    {t('buyNow.upTo')}
                  </Text>
                ) : null}
                <Odometer text={formatMoney(b.priceCents, lang)} variant="priceSmall" tone={b.lowest ? 'mint' : 'default'} />
              </View>
            </View>
            <Bar fraction={b.priceCents / max} index={i} kind="buy" />
          </View>
        ))}

        {model.reference ? (
          <View style={styles.row} testID="ladder-reference">
            <View style={styles.labelRow}>
              <View style={styles.flexText}>
                <Text variant="label" bold>
                  {t('ladder.reference')}
                </Text>
                <Text variant="caption" tone="slate">
                  {t('ladder.referenceTag')}
                </Text>
              </View>
              <Odometer text={formatMoney(model.reference.totalCents, lang)} variant="priceSmall" tone="slate" />
            </View>
            <Bar fraction={model.reference.totalCents / max} index={model.buys.length} kind="reference" />
          </View>
        ) : null}

        {model.monthly.length > 0 ? (
          <View style={[styles.monthly, { borderTopColor: palette.border }]} testID="ladder-monthly">
            <Text variant="subheading">{t('ladder.monthlyTitle')}</Text>
            <Text variant="caption" tone="muted">
              {t('ladder.monthlyNote')}
            </Text>
            {model.monthly.map((m) => (
              <View key={m.id} style={styles.monthlyRow}>
                <Text variant="label" bold style={styles.flexText}>
                  {m.seller}
                </Text>
                <Text variant="label" tone="mint" bold tabular>
                  {t('ladder.perPeriod', { price: formatMoney(m.priceCents, lang), per: m.per })}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {model.coupons.map((c) => (
          <Tappable
            key={c.site}
            testID={`ladder-coupon-${c.site}`}
            onPress={() => void openExternal(c.url)}
            accessibilityRole="link"
            accessibilityLabel={t('ladder.checkOn', { site: c.site })}
            style={[styles.coupon, { borderColor: palette.signals.sky.solid }]}>
            <Ticket size={18} color={palette.signals.sky.ink} />
            <Text variant="label" bold tone="sky" style={styles.flexText}>
              {t('ladder.checkOn', { site: c.site })}
            </Text>
            <ExternalLink size={16} color={palette.signals.sky.ink} />
          </Tappable>
        ))}
      </View>
    </Card>
  );
}

/** One bar on the shared scale. Grows from zero (staggered); jumps to its width with Reduce Motion. */
function Bar({ fraction, index, kind }: { fraction: number; index: number; kind: 'buy' | 'reference' }) {
  const { palette, reduceMotion } = useTheme();
  const [track, setTrack] = useState(0);
  const width = useSharedValue(0);
  const patternId = `ladderHatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const target = Math.max(BAR_H, track * Math.min(1, Math.max(0, fraction)));

  useEffect(() => {
    if (!track) return;
    width.value = reduceMotion
      ? target
      : withDelay(index * BAR_STAGGER, withTiming(target, { duration: motion.slow + 80, easing: Easing.bezier(...motion.easing) }));
  }, [track, target, index, reduceMotion, width]);

  const style = useAnimatedStyle(() => ({ width: width.value }));
  const mint = palette.signals.mint;
  const slate = palette.signals.slate;

  return (
    <View
      style={[styles.track, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}
      onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      <Animated.View
        style={[
          styles.bar,
          kind === 'buy'
            ? { backgroundColor: mint.solid, borderColor: mint.solid }
            : { backgroundColor: slate.tint, borderColor: slate.solid },
          style,
        ]}>
        {kind === 'reference' ? (
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern id={patternId} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <Line x1="0" y1="0" x2="0" y2="8" stroke={slate.solid} strokeWidth="3" />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
          </Svg>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Mint "lowest listed" ribbon: a gentle fade and scale in. No sparkle, no flashing. */
function Ribbon({ label, delay }: { label: string; delay: number }) {
  const { palette, reduceMotion } = useTheme();
  const mint = palette.signals.mint;
  return (
    <Animated.View
      entering={reduceMotion ? undefined : ZoomIn.delay(delay).duration(motion.slow)}
      style={[styles.ribbon, { backgroundColor: mint.tint, borderColor: mint.solid }]}
      testID="lowest-ribbon">
      <BadgeCheck size={16} color={mint.ink} />
      <Text variant="caption" bold tone="mint" style={styles.ribbonText}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  headText: { gap: spacing.xxs },
  row: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
  flexText: { flex: 1, minWidth: 120 },
  priceWrap: { alignItems: 'flex-end' },
  track: { height: BAR_H + 4, borderRadius: radius.pill, borderWidth: 1, padding: 1, overflow: 'hidden' },
  bar: { height: BAR_H, borderRadius: radius.pill, borderWidth: 1.5, overflow: 'hidden' },
  monthly: { gap: spacing.xs, borderTopWidth: 1, paddingTop: spacing.md },
  monthlyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  coupon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  empty: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: 'stretch' },
  ribbon: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  ribbonText: { flexShrink: 1 },
  versions: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
});
