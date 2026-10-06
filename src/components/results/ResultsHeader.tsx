import { router } from 'expo-router';
import { MessageSquareText, Pencil, Pill, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CategoryChip, MarketBadge } from '@/components/search/MedBadges';
import { loc } from '@/data/localize';
import type { Medication } from '@/data/schemas';
import { Button, motion, radius, spacing, Tappable, Text, useTheme } from '@/design';
import type { Selection } from '@/state/medicines';

import { counterHref, pickerHref, shareHref } from './params';

/** Results header: name, "strength × qty" (tap to change), badges, counter card and share. */
export function ResultsHeader({
  medication,
  selection,
  selectionLabel,
}: {
  medication: Medication;
  selection: Selection;
  selectionLabel: string;
}) {
  const { t } = useTranslation('results');
  const { palette, lang, reduceMotion } = useTheme();

  return (
    <View style={styles.wrap} testID="results-header">
      <Text variant="label" tone="accent" bold>
        {t('header.eyebrow')}
      </Text>
      <Text variant="title" testID="results-title">
        {loc(medication.displayName, lang)}
      </Text>

      <Tappable
        testID="change-selection"
        onPress={() => router.dismissTo(pickerHref(selection))}
        accessibilityLabel={t('header.changeLabel', { selection: selectionLabel })}
        style={[styles.selection, { backgroundColor: palette.surface, borderColor: palette.accent }]}>
        <View style={[styles.pillIcon, { backgroundColor: palette.accentSoft }]}>
          <Pill size={18} color={palette.accentInk} />
        </View>
        <Animated.View key={selectionLabel} entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} style={styles.flex}>
          <Text variant="subheading">{selectionLabel}</Text>
        </Animated.View>
        <View style={styles.change}>
          <Pencil size={16} color={palette.accentInk} />
          <Text variant="label" bold tone="accent">
            {t('header.change')}
          </Text>
        </View>
      </Tappable>

      <View style={styles.badges}>
        <MarketBadge status={medication.marketStatus} />
        <CategoryChip category={medication.category} />
      </View>

      <View style={styles.actions}>
        <Button
          variant="secondary"
          compact
          icon={MessageSquareText}
          label={t('header.counter')}
          hint={t('header.counterHint')}
          onPress={() => router.push(counterHref(selection))}
          testID="open-counter-card"
          style={styles.action}
        />
        <Button
          variant="secondary"
          compact
          icon={Share2}
          label={t('header.share')}
          hint={t('header.shareHint')}
          onPress={() => router.push(shareHref(selection))}
          testID="open-share"
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  selection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 2,
  },
  pillIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 160 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  action: { flexGrow: 1, flexBasis: 140 },
});
