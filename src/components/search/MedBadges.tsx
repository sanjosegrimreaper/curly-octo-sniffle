import { Activity, BadgeCheck, Droplet, Droplets, Gauge, HeartPulse, Pill, Tag, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Medication } from '@/data/schemas';
import { Badge, radius, spacing, Text, useTheme } from '@/design';

type Category = Medication['category'];

/** Category → icon. Category chips stay neutral: bright signal colors are reserved for meaning. */
export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  diabetes: Droplet,
  'blood-thinner': Droplets,
  heart: HeartPulse,
  'blood-pressure': Gauge,
  cholesterol: Activity,
  other: Pill,
};

export function CategoryChip({ category }: { category: Category }) {
  const { palette } = useTheme();
  const { t } = useTranslation('search');
  const Icon = CATEGORY_ICON[category];
  return (
    <View style={[styles.chip, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
      <Icon size={14} color={palette.textMuted} />
      <Text variant="caption" bold tone="muted">
        {t(`category.${category}`)}
      </Text>
    </View>
  );
}

/** "Generic available" / "Biosimilar available" / "Brand only". */
export function MarketBadge({ status }: { status: Medication['marketStatus'] }) {
  const { t } = useTranslation('search');
  if (status === 'brandOnly') return <Badge label={t('market.brandOnly')} signal="sky" icon={Tag} />;
  return <Badge label={t(`market.${status}`)} signal="mint" icon={BadgeCheck} />;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
