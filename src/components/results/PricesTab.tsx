import { MapPin, ShoppingBag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { DraftBanner } from '@/components/DraftBanner';
import { getPack } from '@/data/pack';
import type { PriceSummary } from '@/data/prices';
import { Banner, spacing } from '@/design';

import { BuyNowCard } from './BuyNowCard';
import { CostPlusBlock } from './CostPlusBlock';
import { CouponCard } from './CouponCard';
import { PriceLadder } from './PriceLadder';
import { AskCard, CoverageBanner, NadacCard, OutlookCard } from './ReferenceCards';
import { Reveal, SectionHeading } from './Section';
import { WhereToFill } from './WhereToFill';

/**
 * The Prices tab, in the order the spec sets: context → ladder → Buy now → coupons →
 * reference → outlook → questions → where to fill. Each block fades up in sequence.
 */
export function PricesTab({
  summary,
  selectionLabel,
  perDay,
  onSwitchQuantity,
}: {
  summary: PriceSummary;
  selectionLabel: string;
  perDay: number | null;
  onSwitchQuantity: (qty: number) => void;
}) {
  const { t } = useTranslation('results');
  const formula = getPack().costPlus.formula;
  const options = [...summary.comparable, ...summary.monthly];
  const versions = summary.medication.kind === 'biologic' && options.length > 1;
  const key = `${summary.strength.id}:${summary.quantity}`;
  let i = 0;

  return (
    <View style={styles.stack} testID="prices-tab">
      <Reveal index={i++}>
        <DraftBanner />
        <CoverageBanner summary={summary} />
      </Reveal>

      <Reveal index={i++}>
        <PriceLadder key={key} summary={summary} selection={selectionLabel} />
      </Reveal>

      <Reveal index={i++} testID="buy-now-section">
        <SectionHeading icon={ShoppingBag} signal="mint" title={t('buyNow.title')} subtitle={t('buyNow.subtitle')} />
        {versions ? (
          <Banner title={t('ladder.versions')} testID="versions-note" />
        ) : null}
        {options.map((o) => (
          <BuyNowCard key={`${o.id}:${key}`} option={o} strength={summary.strength} perDay={perDay} formula={formula} versions={versions} />
        ))}
        <CostPlusBlock
          status={summary.costPlus}
          medicationId={summary.medication.id}
          strength={summary.strength}
          quantity={summary.quantity}
          onSwitchQuantity={onSwitchQuantity}
        />
      </Reveal>

      <Reveal index={i++}>
        <CouponCard medication={summary.medication} />
      </Reveal>

      <Reveal index={i++}>
        <NadacCard summary={summary} />
      </Reveal>

      <Reveal index={i++}>
        <OutlookCard summary={summary} medication={summary.medication} />
      </Reveal>

      <Reveal index={i++}>
        <AskCard />
      </Reveal>

      <Reveal index={i++} testID="where-to-fill">
        <SectionHeading icon={MapPin} signal="sky" title={t('fill.title')} />
        <WhereToFill />
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
});
