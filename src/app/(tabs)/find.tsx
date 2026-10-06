import { router } from 'expo-router';
import { History, MessageSquarePlus, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { DraftBanner } from '@/components/DraftBanner';
import { MedicationRow, MedicationTile } from '@/components/search/MedicationRow';
import { SearchField } from '@/components/search/SearchField';
import { getPack } from '@/data/pack';
import type { Medication } from '@/data/schemas';
import { buildIndex, search } from '@/domain';
import { Button, EmptyState, minTap, motion, radius, Screen, spacing, Tappable, Text, useTheme } from '@/design';
import { openExternal } from '@/services/links';
import { useMedicines } from '@/state/medicines';

/** Find a medicine: one search field, recent searches and the common prescriptions grid. */
export default function FindScreen() {
  const { t } = useTranslation('search');
  const { reduceMotion, textScale } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const pack = getPack();
  const index = useMemo(() => buildIndex(pack.medications), [pack]);
  const common = useMemo(() => pack.medications.filter((m) => m.common), [pack]);
  const [query, setQuery] = useState('');
  const results = useMemo(() => search(index, query), [index, query]);
  const recents = useMedicines((s) => s.recents);
  const addRecent = useMedicines((s) => s.addRecent);
  const removeRecent = useMedicines((s) => s.removeRecent);
  const typing = query.trim().length > 0;
  const requestUrl = pack.region.requestMedicineUrl;
  // Two tiles per row only when they have room; one column at large text sizes.
  const columns = (Math.min(width, 640) - spacing.md * 2) / (textScale * Math.max(1, fontScale)) >= 330 ? 2 : 1;

  // Announce the result count once typing pauses.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(
        results.length > 0 ? t('resultsCount', { count: results.length }) : t('empty.title'),
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [typing, results.length, query, t]);

  const open = (med: Medication, fromSearch: boolean) => {
    if (fromSearch) addRecent(query.trim());
    router.push(`/drug/${encodeURIComponent(med.id)}`);
  };

  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.delay(i * 40).duration(motion.slow));

  return (
    <Screen inTabs testID="find-screen">
      <View style={styles.head}>
        <Text variant="title">{t('title')}</Text>
        <Text tone="muted">{t('subtitle')}</Text>
      </View>
      <SearchField value={query} onChange={setQuery} onSubmit={() => results[0] && open(results[0].medication, true)} />
      {/* While typing, results come first and the draft notice follows them. */}
      {!typing ? <DraftBanner /> : null}

      {typing ? (
        <View style={styles.list}>
          <Text variant="label" tone="muted" accessibilityLiveRegion="polite" testID="results-count">
            {t('resultsCount', { count: results.length })}
          </Text>
          {results.map((r, i) => (
            <Animated.View key={r.medication.id} entering={enter(i)}>
              <MedicationRow
                medication={r.medication}
                matched={r.matched}
                onPress={() => open(r.medication, true)}
                testID={`result-${r.medication.id}`}
              />
            </Animated.View>
          ))}
          {results.length === 0 ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
              <EmptyState
                testID="search-empty"
                illustration="magnifier"
                title={t('empty.title')}
                body={t('empty.body')}
                action={
                  requestUrl ? (
                    <Button
                      variant="secondary"
                      icon={MessageSquarePlus}
                      external
                      label={t('empty.request')}
                      hint={t('empty.requestHint')}
                      onPress={() => void openExternal(requestUrl)}
                      testID="request-medicine"
                    />
                  ) : undefined
                }
              />
            </Animated.View>
          ) : null}
          <DraftBanner />
        </View>
      ) : (
        <>
          {recents.length > 0 ? (
            <View style={styles.section}>
              <Text variant="heading">{t('recents.title')}</Text>
              <View style={styles.chips}>
                {recents.map((r) => (
                  <RecentChip key={r} term={r} onSearch={() => setQuery(r)} onRemove={() => removeRecent(r)} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.section} testID="common-grid">
            <Text variant="heading">{t('common.title')}</Text>
            <Text variant="label" tone="muted">
              {t('common.subtitle')}
            </Text>
            <View style={styles.grid}>
              {common.map((m, i) => (
                <Animated.View
                  key={m.id}
                  entering={enter(i)}
                  style={columns === 2 ? styles.gridCell : styles.gridCellFull}>
                  <MedicationTile medication={m} onPress={() => open(m, false)} testID={`common-${m.id}`} />
                </Animated.View>
              ))}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

/** A recent search: tap the words to search again, tap × to forget it. */
function RecentChip({ term, onSearch, onRemove }: { term: string; onSearch: () => void; onRemove: () => void }) {
  const { t } = useTranslation('search');
  const { palette } = useTheme();
  return (
    <View style={[styles.recent, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Tappable onPress={onSearch} accessibilityLabel={t('recents.search', { term })} style={styles.recentMain}>
        <History size={16} color={palette.textMuted} />
        <Text variant="label" bold>
          {term}
        </Text>
      </Tappable>
      <Tappable
        onPress={onRemove}
        accessibilityLabel={t('recents.remove', { term })}
        style={[styles.recentRemove, { borderLeftColor: palette.border }]}>
        <X size={18} color={palette.textMuted} />
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs, marginTop: spacing.xs },
  list: { gap: spacing.sm },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridCell: { flexGrow: 1, flexBasis: '46%', minWidth: 150 },
  gridCellFull: { flexBasis: '100%' },
  recent: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.pill, borderWidth: 1, overflow: 'hidden' },
  recentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTap,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  recentRemove: { minWidth: minTap, minHeight: minTap, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1 },
});
