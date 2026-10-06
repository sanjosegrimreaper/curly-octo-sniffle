import { AlertCircle, BadgeCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { SourceRef } from '@/data/schemas';
import { freshness, isConfirmed, todayISO } from '@/domain';
import { formatDate } from '@/i18n/format';
import { useUi } from '@/state/ui';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, radius, spacing } from '../tokens';
import { FreshnessRing } from './FreshnessRing';
import { Tappable } from './Tappable';

/** "Verified Oct 1, 2026 · CMS" — every fact on screen carries one. Tap for the source sheet. */
export function SourceChip({
  sources,
  verifiedAsOf,
  recordId,
  title,
  label,
}: {
  sources: SourceRef[];
  verifiedAsOf: string;
  recordId: string;
  /** Sheet title, e.g. the card's heading. */
  title?: string;
  /** Override the leading word ("Verified", "Snapshot", "As of"). */
  label?: string;
}) {
  const { palette, lang } = useTheme();
  const { t } = useTranslation('common');
  const openSheet = useUi((s) => s.openSheet);
  const first = sources[0];
  const f = freshness(verifiedAsOf, todayISO());
  const date = formatDate(verifiedAsOf, lang);
  const confirmed = isConfirmed(sources);
  const text = confirmed
    ? `${label ?? t('source.verified')} ${date}${first ? ` · ${first.name}` : ''}`
    : `${t('source.unconfirmedChip')}${first ? ` · ${first.name}` : ''}`;

  return (
    <Tappable
      onPress={() =>
        openSheet({ kind: 'source', title: title ?? t('source.sheetTitle'), sources, verifiedAsOf, recordId })
      }
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={t('source.hint')}
      style={[
        styles.chip,
        confirmed
          ? { borderColor: palette.border, backgroundColor: palette.surfaceSunken }
          : { borderColor: palette.signals.sunflower.solid, backgroundColor: palette.signals.sunflower.tint },
      ]}>
      {!confirmed ? (
        <AlertCircle size={16} color={palette.signals.sunflower.ink} style={{ flexShrink: 0 }} />
      ) : f.level === 'stale' ? (
        <FreshnessRing verifiedAsOf={verifiedAsOf} size={18} />
      ) : (
        <BadgeCheck size={16} color={palette.signals.mint.ink} style={{ flexShrink: 0 }} />
      )}
      <Text variant="caption" tone={confirmed ? 'muted' : 'sunflower'} style={{ flexShrink: 1 }}>
        {text}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTap - 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    // Not a pill: chips often wrap to two lines at large text sizes.
    borderRadius: radius.sm,
    borderWidth: 1,
    maxWidth: '100%',
  },
});
