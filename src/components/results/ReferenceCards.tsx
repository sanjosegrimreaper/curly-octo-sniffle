import { CalendarClock, ChevronDown, ChevronUp, Info, MessageCircleQuestion, Scale, TrendingDown, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import type { PriceSummary } from '@/data/prices';
import type { Medication } from '@/data/schemas';
import { Banner, Button, Card, GlossaryChip, ReadAloud, SourceChip, spacing, Text, useTheme } from '@/design';
import { formatDate, formatMoney, formatNumber, formatUnitPrice } from '@/i18n/format';
import { LANGUAGES, type Lang } from '@/i18n/languages';
import { useScreener } from '@/state/screener';

import { Odometer } from './Odometer';
import { Bullet } from './Section';

/**
 * Fair-price reference (NADAC): slate, hatched, with the math and dates — or an honest
 * "not loaded yet". Nobody can buy at this number, and the card says so.
 */
export function NadacCard({ summary }: { summary: PriceSummary }) {
  const { t } = useTranslation('results');
  const { palette, lang } = useTheme();
  const feed = getPack().nadac;
  const nadac = summary.nadacFeedLoaded ? summary.nadac : null;
  const slate = palette.signals.slate;
  const [open, setOpen] = useState(false);

  return (
    <Card signal="slate" treatment="hatched" testID={nadac ? 'nadac-card' : 'nadac-not-loaded'} style={styles.card}>
      <View style={styles.labelRow}>
        <Scale size={20} color={slate.ink} />
        <Text variant="subheading" style={styles.flex}>
          {t('nadac.title')}
        </Text>
      </View>
      <Text>{t('nadac.body')}</Text>
      {nadac ? (
        <>
          <Text variant="label" bold tone="slate">
            {t('nadac.label')}
          </Text>
          <Odometer text={formatMoney(nadac.total.totalCents, lang)} variant="priceSmall" tone="slate" />
          <Button
            variant="ghost"
            compact
            icon={open ? ChevronUp : ChevronDown}
            label={open ? t('nadac.hideDetails') : t('nadac.showDetails')}
            onPress={() => setOpen((v) => !v)}
            testID="nadac-details-toggle"
            style={styles.toggle}
          />
          {open ? (
            <View style={styles.details}>
              <View style={[styles.math, { backgroundColor: palette.surface, borderColor: slate.solid }]}>
                <Text tabular>
                  {t('nadac.math', {
                    perUnit: formatUnitPrice(nadac.total.perUnit, lang),
                    unit: t(`nadac.unit.${nadac.entry.pricingUnit}`),
                    units: formatNumber(nadac.total.units, lang),
                    total: formatMoney(nadac.total.totalCents, lang),
                  })}
                </Text>
              </View>
              <Text variant="label">{t('nadac.cantBuy')}</Text>
              {nadac.asOfDate ? (
                <Text variant="caption" tone="muted">
                  {t('nadac.asOf', { date: formatDate(nadac.asOfDate, lang) })}
                </Text>
              ) : null}
              <Text variant="caption" tone="muted">
                {t('nadac.effective', { date: formatDate(nadac.entry.effectiveDate, lang) })}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text variant="label" bold tone="slate">
          {t('nadac.notLoaded')}
        </Text>
      )}
      <GlossaryChip termId="nadac" />
      <SourceChip sources={feed.sources} verifiedAsOf={feed.verifiedAsOf} recordId="nadac:feed" title={t('nadac.title')} />
    </Card>
  );
}

/**
 * Generic outlook (tangerine). Shown only for within-12-months and 1–3-year tiers, plus a
 * single info line when a lower-cost version already exists. Never a promised date.
 */
export function OutlookCard({ summary, medication }: { summary: PriceSummary; medication: Medication }) {
  const { t } = useTranslation('results');
  const { palette, lang } = useTheme();
  const record = getPack().outlooks.find((o) => o.medicationId === medication.id);
  const { tier } = summary.outlook;
  if (!record) return null;
  const tangerine = palette.signals.tangerine;
  const biologic = medication.kind === 'biologic';
  const chip = (
    <SourceChip sources={record.sources} verifiedAsOf={record.verifiedAsOf} recordId={`outlook:${medication.id}`} title={t('outlook.title')} />
  );
  const biosimilarLine = biologic ? (
    <View style={styles.explainer}>
      <Text variant="label" tone="muted">
        {t('outlook.biosimilar')}
      </Text>
      <GlossaryChip termId="biosimilar" />
    </View>
  ) : null;

  if (tier === 'alreadyHasAlternative') {
    return (
      <Card testID="outlook-alternative" style={styles.card}>
        <View style={styles.labelRow}>
          <Info size={20} color={palette.signals.sky.ink} />
          <Text variant="subheading" style={styles.flex}>
            {t('outlook.alreadyTitle')}
          </Text>
        </View>
        <Text>{loc(record.basis, lang)}</Text>
        {biosimilarLine}
        {chip}
      </Card>
    );
  }
  if (tier !== 'within12' && tier !== 'oneToThree') return null;
  if (tier === 'within12' && !record.earliestDate) return null;

  return (
    <Card signal="tangerine" treatment="solid" testID={`outlook-${tier}`} style={styles.card}>
      <View style={styles.labelRow}>
        <TrendingDown size={20} color={tangerine.ink} />
        <Text variant="subheading" style={styles.flex}>
          {t('outlook.title')}
        </Text>
      </View>
      <Text variant="subheading" tone="tangerine">
        {tier === 'within12' && record.earliestDate
          ? t('outlook.within12', { date: formatMonthYear(record.earliestDate, lang) })
          : t('outlook.oneToThree')}
      </Text>
      {record.earliestDate ? (
        <View style={styles.dateRow}>
          <CalendarClock size={18} color={tangerine.ink} />
          <View style={styles.flex}>
            <Text variant="label" bold>
              {t('outlook.earliest', { date: formatDate(record.earliestDate, lang, 'long') })}
            </Text>
            {record.label ? (
              <Text variant="caption" tone="muted">
                {record.label}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <Text variant="label">{loc(record.basis, lang)}</Text>
      {biosimilarLine}
      {chip}
    </Card>
  );
}

/** Questions only — never advice. */
export function AskCard() {
  const { t } = useTranslation('results');
  const { palette } = useTheme();
  const questions = [t('ask.q1'), t('ask.q2'), t('ask.q3')];
  return (
    <Card signal="lilac" treatment="outline" testID="ask-card" style={styles.card}>
      <View style={styles.labelRow}>
        <MessageCircleQuestion size={20} color={palette.signals.lilac.ink} />
        <Text variant="subheading" style={styles.flex}>
          {t('ask.title')}
        </Text>
      </View>
      <Text variant="label" tone="muted">
        {t('ask.subtitle')}
      </Text>
      <View style={styles.questions}>
        {questions.map((q) => (
          <Bullet key={q}>{q}</Bullet>
        ))}
      </View>
      <ReadAloud text={[t('ask.title'), ...questions].join('. ')} />
    </Card>
  );
}

/**
 * Coverage context at the top of Prices, from the screener: Medicare and Medi-Cal get their
 * own caution; job, Covered California or other insurance gets "Also check your copay" with
 * the Copay Check (just the two numbers, no claims beyond that).
 */
export function CoverageBanner({ summary }: { summary: PriceSummary }) {
  const { t } = useTranslation('results');
  const { lang } = useTheme();
  const coverage = useScreener((st) => st.coverage);
  const coverageType = useScreener((st) => st.coverageType);
  const copayCents = useScreener((st) => st.copayCents);
  if (coverage !== 'yes') return null;

  if (coverageType === 'medicare') {
    return <Banner tone="caution" title={t('coverage.medicareTitle')} body={t('coverage.medicare')} testID="coverage-medicare" />;
  }
  if (coverageType === 'medi-cal') {
    return <Banner title={t('coverage.mediCalTitle')} body={t('coverage.mediCal')} testID="coverage-medi-cal" />;
  }
  const lowest = summary.lowest;
  return (
    <Banner title={t('copay.title')} body={t('copay.body')} icon={Wallet} testID="copay-banner">
      {copayCents !== null ? (
        <Text variant="label" bold tabular testID="copay-compare">
          {lowest
            ? t('copay.compare', { copay: formatMoney(copayCents, lang), lowest: formatMoney(lowest.priceCents, lang) })
            : t('copay.compareNoPrice', { copay: formatMoney(copayCents, lang) })}
        </Text>
      ) : null}
      <View style={styles.glossaryRow}>
        <GlossaryChip termId="copay" />
        <GlossaryChip termId="deductible" />
      </View>
    </Banner>
  );
}

/** "April 2028" in the person's language. */
function formatMonthYear(iso: string, lang: Lang) {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  return new Intl.DateTimeFormat(LANGUAGES[lang].intlTag, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 15)),
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  math: { padding: spacing.sm, borderRadius: 12, borderWidth: 1, alignSelf: 'stretch' },
  details: { gap: spacing.xs },
  toggle: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm },
  dateRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  explainer: { gap: spacing.xs },
  questions: { gap: spacing.xs },
  glossaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xxs },
});
