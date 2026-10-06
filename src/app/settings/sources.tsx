import unverified from '@data/packs/ca-south-bay/unverified.json';
import { AlertTriangle, BadgeCheck, Flag } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { packStats } from '@/components/settings/packStats';
import { useNadacFeed } from '@/data/feeds';
import { loc } from '@/data/localize';
import { getPack } from '@/data/pack';
import { CONFIRMED_METHODS, type VerificationMethod } from '@/data/schemas';
import {
  Banner,
  Button,
  Card,
  FreshnessRing,
  GlossaryChip,
  HStack,
  radius,
  Screen,
  spacing,
  Text,
  useTheme,
  VStack,
} from '@/design';
import { formatDate } from '@/i18n/format';
import { openExternal } from '@/services/links';

const METHODS: VerificationMethod[] = [...CONFIRMED_METHODS, 'unconfirmed'];

/** Data sources & dates: what this data version holds, how much is confirmed, and how we verify. */
export default function SourcesScreen() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { palette, lang } = useTheme();
  const pack = getPack();
  const feed = useNadacFeed();
  const stats = useMemo(() => packStats(pack, feed), [pack, feed]);
  const draft = pack.manifest.status === 'draft';
  const snapshot = pack.costPlus.snapshotDate;

  return (
    <Screen back title={t('sources.title')} testID="sources-screen">
      <Text tone="muted">{t('sources.intro')}</Text>

      <Card testID="sources-pack">
        <Text variant="heading">{t('sources.pack.title')}</Text>
        <Text>{t('sources.pack.region', { name: loc(pack.region.name, lang) })}</Text>
        <Text variant="label" tone="muted">
          {t('sources.pack.id', { id: pack.manifest.packId })}
        </Text>
        <Text variant="label" bold>
          {t('sources.pack.version', { version: pack.manifest.version })}
        </Text>
        <HStack gap="xs">
          <FreshnessRing verifiedAsOf={pack.manifest.generatedAt} size={22} />
          <Text variant="label">{t('sources.pack.generated', { date: formatDate(pack.manifest.generatedAt, lang, 'long') })}</Text>
        </HStack>
      </Card>

      {draft ? (
        <Banner tone="caution" title={t('sources.pack.statusDraft')} body={t('sources.pack.statusDraftBody')} testID="sources-draft" />
      ) : (
        <Banner tone="success" icon={BadgeCheck} title={t('sources.pack.statusRelease')} body={t('sources.pack.statusReleaseBody')} />
      )}

      <Text variant="heading">{t('sources.prices.title')}</Text>
      <Card signal="slate" treatment="hatched" testID="sources-nadac">
        <HStack gap="xs">
          <Text variant="subheading" style={{ flexShrink: 1 }}>
            {t('sources.prices.nadac')}
          </Text>
          <GlossaryChip termId="nadac" />
        </HStack>
        <HStack gap="xs">
          {feed.asOfDate ? <FreshnessRing verifiedAsOf={feed.asOfDate} size={22} /> : null}
          <Text bold>
            {feed.asOfDate ? t('sources.prices.nadacAsOf', { date: formatDate(feed.asOfDate, lang) }) : t('sources.prices.notLoaded')}
          </Text>
        </HStack>
        <Text variant="label">{t('sources.prices.nadacNote')}</Text>
      </Card>
      <Card signal="mint" treatment="outline" testID="sources-costplus">
        <Text variant="subheading">{t('sources.prices.costPlus')}</Text>
        <HStack gap="xs">
          {snapshot ? <FreshnessRing verifiedAsOf={snapshot} size={22} /> : null}
          <Text bold>{snapshot ? t('sources.prices.costPlusDate', { date: formatDate(snapshot, lang) }) : t('sources.prices.notLoaded')}</Text>
        </HStack>
      </Card>

      <Text variant="heading">{t('sources.files.title')}</Text>
      <Text variant="label" tone="muted">
        {t('sources.files.hint')}
      </Text>
      <Card padded={false} testID="sources-files">
        {stats.map((s, i) => {
          const pct = s.records > 0 ? s.confirmed / s.records : 0;
          return (
            <View
              key={s.key}
              testID={`sources-file-${s.key}`}
              accessible
              accessibilityLabel={[
                t(`sources.files.names.${s.key}`),
                s.records > 0 ? t('sources.files.records', { count: s.records }) : t('sources.files.none'),
                s.records > 0 ? t('sources.files.confirmed', { count: s.confirmed }) : null,
                s.unconfirmed > 0 ? t('sources.files.unconfirmed', { count: s.unconfirmed }) : null,
              ]
                .filter(Boolean)
                .join('. ')}
              style={[styles.fileRow, i > 0 ? { borderTopWidth: 1, borderTopColor: palette.border } : null]}>
              <HStack gap="xs">
                <Text bold style={{ flex: 1, minWidth: 140 }}>
                  {t(`sources.files.names.${s.key}`)}
                </Text>
                <Text variant="label" tone="muted" tabular>
                  {s.records > 0 ? t('sources.files.records', { count: s.records }) : t('sources.files.none')}
                </Text>
              </HStack>
              {s.records > 0 ? (
                <>
                  <View style={[styles.bar, { backgroundColor: palette.signals.sunflower.tint, borderColor: palette.signals.sunflower.solid }]}>
                    <View style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: palette.signals.mint.solid }} />
                  </View>
                  <HStack gap="sm">
                    <HStack gap="xxs">
                      <BadgeCheck size={14} color={palette.signals.mint.ink} />
                      <Text variant="caption" tone="mint" bold>
                        {t('sources.files.confirmed', { count: s.confirmed })}
                      </Text>
                    </HStack>
                    {s.unconfirmed > 0 ? (
                      <HStack gap="xxs">
                        <AlertTriangle size={14} color={palette.signals.sunflower.ink} />
                        <Text variant="caption" tone="sunflower" bold>
                          {t('sources.files.unconfirmed', { count: s.unconfirmed })}
                        </Text>
                      </HStack>
                    ) : null}
                  </HStack>
                </>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Text variant="heading">{t('sources.unverified.title')}</Text>
      <Text variant="label" tone="muted">
        {t('sources.unverified.hint')}
      </Text>
      <VStack gap="sm">
        {unverified.map((u) => (
          <Card key={u.item} signal="slate" treatment="dashed">
            <Text bold>{u.item}</Text>
            <Text variant="label" tone="muted">
              {u.reason}
            </Text>
            <Text variant="caption" tone="muted">
              {t('sources.unverified.tried', { date: formatDate(u.lastTried, lang) })}
            </Text>
          </Card>
        ))}
      </VStack>

      <Text variant="heading">{t('sources.verify.title')}</Text>
      <Text>{t('sources.verify.intro')}</Text>
      <Card padded={false}>
        {METHODS.map((m, i) => (
          <View key={m} style={[styles.fileRow, i > 0 ? { borderTopWidth: 1, borderTopColor: palette.border } : null]}>
            <HStack gap="xs">
              {m === 'unconfirmed' ? (
                <AlertTriangle size={18} color={palette.signals.sunflower.ink} />
              ) : (
                <BadgeCheck size={18} color={palette.signals.mint.ink} />
              )}
              <Text bold style={{ flexShrink: 1 }}>
                {tc(`source.method.${m}`)}
              </Text>
            </HStack>
            <Text variant="label" tone="muted">
              {t(`sources.verify.methods.${m}`)}
            </Text>
          </View>
        ))}
      </Card>
      <Text variant="label">{t('sources.verify.stale')}</Text>

      {pack.region.reportProblemUrl ? (
        <Button
          variant="secondary"
          icon={Flag}
          external
          label={t('sources.report')}
          onPress={() => void openExternal(pack.region.reportProblemUrl ?? '')}
          testID="sources-report"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fileRow: { padding: spacing.md, gap: spacing.xs },
  bar: { height: 10, borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row', borderWidth: 1 },
});
