import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { haptic } from '@/services/haptics';
import { useApplications } from '@/state/applications';
import { useUi } from '@/state/ui';

/**
 * Whether a program is tracked, plus `ensureTracked()`, which starts tracking it (once) and
 * tells the person with a toast. Ticking a document or saving a note tracks it automatically,
 * because that's where those answers are kept.
 */
export function useTrack(programId: string | undefined) {
  const { t } = useTranslation('programs');
  const tracked = useApplications((s) => (programId ? !!s.byProgram[programId] : false));
  const showToast = useUi((s) => s.showToast);

  const ensureTracked = useCallback(
    (message?: string) => {
      if (!programId) return false;
      if (useApplications.getState().byProgram[programId]) return false;
      useApplications.getState().track(programId);
      haptic.success();
      showToast(message ?? t('card.tracked'), 'success');
      return true;
    },
    [programId, showToast, t],
  );

  return { tracked, ensureTracked };
}
