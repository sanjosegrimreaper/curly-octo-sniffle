import { useTranslation } from 'react-i18next';

import { getPack } from '@/data/pack';
import { Banner } from '@/design';

/** Shown while the data pack is a draft (facts not yet confirmed on official pages). */
export function DraftBanner() {
  const { t } = useTranslation('common');
  if (getPack().manifest.status !== 'draft') return null;
  return <Banner tone="caution" title={t('draft.title')} body={t('draft.body')} testID="draft-banner" />;
}
