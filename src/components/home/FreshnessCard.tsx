import { router, type Href } from 'expo-router';
import { ChevronRight, Database } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useNadacFeed } from '@/data/feeds';
import { getPack } from '@/data/pack';
import { freshness, todayISO } from '@/domain';
import { FreshnessRing, GlossaryChip, radius, spacing, Tappable, Text, useTheme } from '@/design';
import { formatDate } from '@/i18n/format';

/** Data freshness: pack version + status, and the NADAC as-of date. Opens Data sources & dates. */
export function FreshnessCard() {
  const { t } = useTranslation('plan');
  const { t: tc } = useTranslation('common');
  const { palette, lang } = useTheme();
  const pack = getPack();
  const feed = useNadacFeed();
  const today = todayISO();
  const packAge = freshness(pack.manifest.generatedAt, today);
  const draft = pack.manifest.status === 'draft';

  const nadacText = feed.asOfDate
    ? t('freshness.nadac', { date: formatDate(feed.asOfDate, lang) })
    : t('freshness.nadacNotLoaded');

  return (
    <View style={{ gap: spacing.xs }}>
      <Tappable
        testID="plan-freshness"
        onPress={() => router.push('/settings/sources' as Href)}
        accessibilityLabel={[
          t('freshness.title'),
          t('freshness.pack', { version: pack.manifest.version }),
          draft ? t('freshness.statusDraft') : t('freshness.statusRelease'),
          t('freshness.packDate', { date: formatDate(pack.manifest.generatedAt, lang) }),
          nadacText,
        ].join('. ')}
        accessibilityHint={t('freshness.open')}
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: palette.signals.sky.tint }]}>
            <Database size={20} color={palette.signals.sky.ink} />
          </View>
          <Text variant="subheading" style={{ flex: 1 }}>
            {t('freshness.title')}
          </Text>
          <ChevronRight size={22} color={palette.textMuted} />
        </View>

        <View style={styles.line}>
          <FreshnessRing verifiedAsOf={pack.manifest.generatedAt} size={24} />
          <View style={{ flex: 1 }}>
            <Text variant="label" bold>
              {t('freshness.pack', { version: pack.manifest.version })}
            </Text>
            <Text variant="caption" tone={draft ? 'sunflower' : 'mint'}>
              {draft ? t('freshness.statusDraft') : t('freshness.statusRelease')}
            </Text>
            <Text variant="caption" tone="muted">
              {t('freshness.packDate', { date: formatDate(pack.manifest.generatedAt, lang) })} ·{' '}
              {tc(`source.freshness.${packAge.level}`, { count: packAge.days })}
            </Text>
          </View>
        </View>

        <View style={styles.line}>
          {feed.asOfDate ? (
            <FreshnessRing verifiedAsOf={feed.asOfDate} size={24} />
          ) : (
            <View style={[styles.emptyRing, { borderColor: palette.borderStrong }]} />
          )}
          <Text variant="label" tone={feed.asOfDate ? 'default' : 'muted'} style={{ flex: 1 }}>
            {nadacText}
          </Text>
        </View>
      </Tappable>
      <GlossaryChip termId="nadac" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  emptyRing: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderStyle: 'dashed' },
});
