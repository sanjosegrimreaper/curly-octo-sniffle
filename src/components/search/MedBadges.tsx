import { BadgeCheck, Droplet, Droplets, Gauge, HeartPulse, Pill, Tag, TrendingDown, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Medication } from '@/data/schemas';
import { Badge, radius, spacing, Text, useTheme, type SignalName } from '@/design';

type Category = Medication['category'];

/** Category → signal hue + icon. Always shown with its text label, never color alone. */
export const CATEGORY_STYLE: Record<Category, { signal: SignalName; icon: LucideIcon }> = {
  diabetes: { signal: 'sky', icon: Droplet },
  'blood-thinner': { signal: 'lilac', icon: Droplets },
  heart: { signal: 'coral', icon: HeartPulse },
  'blood-pressure': { signal: 'mint', icon: Gauge },
  cholesterol: { signal: 'tangerine', icon: TrendingDown },
  other: { signal: 'slate', icon: Pill },
};

export function CategoryChip({ category }: { category: Category }) {
  const { palette } = useTheme();
  const { t } = useTranslation('search');
  const { signal, icon: Icon } = CATEGORY_STYLE[category];
  const s = palette.signals[signal];
  return (
    <View style={[styles.chip, { backgroundColor: s.tint }]}>
      <Icon size={14} color={s.ink} />
      <Text variant="caption" bold style={{ color: s.ink }}>
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
  },
});
