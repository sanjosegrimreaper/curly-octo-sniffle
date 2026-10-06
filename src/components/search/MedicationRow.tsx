import { ChevronRight, Pill } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { medTitle } from '@/components/results/labels';
import { loc } from '@/data/localize';
import type { Medication } from '@/data/schemas';
import { normalize } from '@/domain';
import { radius, spacing, Tappable, Text, useTheme } from '@/design';
import type { Lang } from '@/i18n/languages';

import { CategoryChip, MarketBadge } from './MedBadges';

const MAX_STRENGTHS = 3;

/** "2.5 mg tablet · 5 mg tablet" (at most three, then "+N more"). */
export function strengthsSummary(med: Medication, lang: Lang, more: (count: number) => string): string {
  const labels = med.strengths.map((s) => loc(s.label, lang));
  const shown = labels.slice(0, MAX_STRENGTHS).join(' · ');
  return labels.length > MAX_STRENGTHS ? `${shown} · ${more(labels.length - MAX_STRENGTHS)}` : shown;
}

function NameLine({ med, lang }: { med: Medication; lang: Lang }) {
  const title = medTitle(med, lang);
  return (
    <Text variant="subheading">
      {title.primary}
      {title.secondary ? (
        <Text variant="body" tone="muted">
          {` · ${title.secondary}`}
        </Text>
      ) : null}
    </Text>
  );
}

/** One search result: brand (bold) · generic, strengths, category chip, market badge. */
export function MedicationRow({
  medication,
  matched,
  onPress,
  testID,
}: {
  medication: Medication;
  /** The pack term that matched the query (shown when it isn't already in the name). */
  matched?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation('search');
  const { palette, lang } = useTheme();
  const title = medTitle(medication, lang);
  const strengths = strengthsSummary(medication, lang, (count) => t('moreStrengths', { count }));
  const shownNames = normalize(`${title.primary} ${title.secondary ?? ''} ${loc(medication.displayName, lang)}`);
  const showMatched = matched && !shownNames.includes(normalize(matched));
  const label = [
    title.secondary ? `${title.primary}, ${title.secondary}` : title.primary,
    strengths,
    t(`category.${medication.category}`),
    t(`market.${medication.marketStatus}`),
  ].join('. ');

  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint={t('openHint')}
      style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow }]}>
      <View style={[styles.icon, { backgroundColor: palette.accentSoft }]}>
        <Pill size={22} color={palette.accentInk} />
      </View>
      <View style={styles.body}>
        <NameLine med={medication} lang={lang} />
        <Text variant="label" tone="muted">
          {strengths}
        </Text>
        {showMatched ? (
          <Text variant="caption" bold tone="accent">
            {t('matched', { term: matched })}
          </Text>
        ) : null}
        <View style={styles.badges}>
          <CategoryChip category={medication.category} />
          <MarketBadge status={medication.marketStatus} />
        </View>
      </View>
      <ChevronRight size={22} color={palette.textMuted} />
    </Tappable>
  );
}

/** A tile in the "Common prescriptions" grid. */
export function MedicationTile({ medication, onPress, testID }: { medication: Medication; onPress: () => void; testID?: string }) {
  const { t } = useTranslation('search');
  const { palette, lang } = useTheme();
  const title = medTitle(medication, lang);
  const strengths = strengthsSummary(medication, lang, (count) => t('moreStrengths', { count }));
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={[title.secondary ? `${title.primary}, ${title.secondary}` : title.primary, strengths, t(`category.${medication.category}`), t(`market.${medication.marketStatus}`)].join('. ')}
      accessibilityHint={t('openHint')}
      style={[styles.tile, { backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow }]}>
      <CategoryChip category={medication.category} />
      <NameLine med={medication} lang={lang} />
      <Text variant="caption" tone="muted">
        {strengths}
      </Text>
      <View style={styles.tileFoot}>
        <MarketBadge status={medication.marketStatus} />
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  body: { flex: 1, gap: spacing.xxs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xxs },
  tile: {
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  tileFoot: { marginTop: 'auto', paddingTop: spacing.xxs },
});
