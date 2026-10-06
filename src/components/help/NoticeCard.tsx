import { CalendarClock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { pickLocalized } from '@/data/localize';
import type { Notice } from '@/data/schemas';
import { Banner, SourceChip, spacing, Text, useTheme } from '@/design';
import { formatDate } from '@/i18n/format';

/** A rule change: banner (caution or info), who it is for, its effective date, and the source. */
export function NoticeCard({ notice, today }: { notice: Notice; today: string }) {
  const { t } = useTranslation('help');
  const { t: tc } = useTranslation('common');
  const { palette, lang } = useTheme();
  const title = pickLocalized(notice.title, lang);
  const body = pickLocalized(notice.body, lang);
  const who = notice.appliesTo.map((a) => t(`hub.notices.who.${a}`)).join(', ');
  const date = notice.effectiveDate
    ? notice.effectiveDate > today
      ? t('hub.notices.starts', { date: formatDate(notice.effectiveDate, lang) })
      : t('hub.notices.since', { date: formatDate(notice.effectiveDate, lang) })
    : null;

  return (
    <Banner
      testID={`notice-${notice.id}`}
      tone={notice.severity === 'caution' ? 'caution' : 'info'}
      title={title.text}
      body={body.text}>
      {title.fellBack || body.fellBack ? (
        <Text variant="caption" tone="muted">
          {tc('notTranslated')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center', marginTop: spacing.xxs }}>
        {date ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
            <CalendarClock size={16} color={palette.textMuted} />
            <Text variant="caption" bold>
              {date}
            </Text>
          </View>
        ) : null}
        <Text variant="caption" tone="muted">
          {t('hub.notices.for', { who })}
        </Text>
      </View>
      <View style={{ marginTop: spacing.xxs }}>
        <SourceChip sources={notice.sources} verifiedAsOf={notice.verifiedAsOf} recordId={`notice:${notice.id}`} title={title.text} />
      </View>
    </Banner>
  );
}
