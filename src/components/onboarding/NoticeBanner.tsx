import { useTranslation } from 'react-i18next';

import { pickLocalized } from '@/data/localize';
import type { Notice } from '@/data/schemas';
import { Banner, SourceChip, Text, useTheme } from '@/design';

/** A pack notice ("Rules changed recently") with its source chip. Caution notices use the sunflower banner. */
export function NoticeBanner({ notice }: { notice: Notice }) {
  const { lang } = useTheme();
  const { t } = useTranslation('common');
  const title = pickLocalized(notice.title, lang);
  const body = pickLocalized(notice.body, lang);
  return (
    <Banner
      tone={notice.severity === 'caution' ? 'caution' : 'info'}
      title={title.text}
      body={body.text}
      testID={`notice-${notice.id}`}>
      {title.fellBack || body.fellBack ? (
        <Text variant="caption" tone="muted">
          {t('notTranslated')}
        </Text>
      ) : null}
      <SourceChip
        sources={notice.sources}
        verifiedAsOf={notice.verifiedAsOf}
        recordId={`notice:${notice.id}`}
        title={title.text}
      />
    </Banner>
  );
}
