import { Ticket } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Medication } from '@/data/schemas';
import { Button, Card, GlossaryChip, SourceChip, spacing, Text, useTheme } from '@/design';
import { openExternal } from '@/services/links';

import { Bullet } from './Section';

/**
 * Coupons: links only, never a dollar amount (sky outline). A missing partner page
 * hides its button and says "Not listed".
 */
export function CouponCard({ medication }: { medication: Medication }) {
  const { t } = useTranslation('results');
  const { palette } = useTheme();
  const sky = palette.signals.sky;
  const { goodRxUrl, singleCareUrl } = medication;

  return (
    <Card signal="sky" treatment="outline" testID="coupon-card" style={styles.card}>
      <View style={styles.labelRow}>
        <Ticket size={20} color={sky.ink} />
        <Text variant="subheading" style={styles.flex}>
          {t('coupons.title')}
        </Text>
      </View>
      <Text variant="label" tone="muted">
        {t('coupons.subtitle')}
      </Text>

      <View style={styles.buttons}>
        {goodRxUrl ? (
          <Button
            variant="secondary"
            compact
            external
            label={t('coupons.goodRx')}
            onPress={() => void openExternal(goodRxUrl)}
            testID="coupon-goodrx"
            style={styles.button}
          />
        ) : null}
        {singleCareUrl ? (
          <Button
            variant="secondary"
            compact
            external
            label={t('coupons.singleCare')}
            onPress={() => void openExternal(singleCareUrl)}
            testID="coupon-singlecare"
            style={styles.button}
          />
        ) : null}
      </View>
      {!goodRxUrl ? <Text variant="label" bold>{t('coupons.notListedSite', { site: 'GoodRx' })}</Text> : null}
      {!singleCareUrl ? <Text variant="label" bold>{t('coupons.notListedSite', { site: 'SingleCare' })}</Text> : null}

      <View style={styles.notes}>
        <Bullet>{t('coupons.noteVaries')}</Bullet>
        {goodRxUrl ? <Bullet>{t('coupons.noteGoodRx')}</Bullet> : null}
        {singleCareUrl ? <Bullet>{t('coupons.noteSingleCare')}</Bullet> : null}
        <Bullet>{t('coupons.noteInsurance')}</Bullet>
      </View>
      <GlossaryChip termId="coupon" />
      <SourceChip
        sources={couponSources(medication)}
        verifiedAsOf={medication.verifiedAsOf}
        recordId={`medication:${medication.id}`}
        title={t('coupons.title')}
      />
    </Card>
  );
}

/** The sources for the coupon links themselves (GoodRx / SingleCare pages), else the medication's. */
function couponSources(medication: Medication) {
  const hosts = [medication.goodRxUrl, medication.singleCareUrl].flatMap((u) => {
    try {
      return u ? [new URL(u).hostname] : [];
    } catch {
      return [];
    }
  });
  const own = medication.sources.filter((s) => {
    try {
      return hosts.includes(new URL(s.url).hostname);
    } catch {
      return false;
    }
  });
  return own.length > 0 ? own : medication.sources;
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  button: { flexGrow: 1, flexBasis: 220 },
  notes: { gap: spacing.xxs },
});
