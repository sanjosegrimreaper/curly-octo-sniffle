import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import { getPack } from '@/data/pack';
import { priceSummary } from '@/data/prices';
import { ThemeProvider } from '@/design';
import { initI18n } from '@/i18n';
import type { SavedMedicine, Selection } from '@/state/medicines';

export const TODAY = '2026-10-06';
const i18n = initI18n('en');

export async function renderUi(ui: ReactElement) {
  return await render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider langOverride="en">{ui}</ThemeProvider>
    </I18nextProvider>,
  );
}

/** A saved entry for a selection in the bundled pack. */
export function saved(sel: Selection, extra: Partial<SavedMedicine> = {}): SavedMedicine {
  return {
    ...sel,
    key: `${sel.drugId}:${sel.strengthId}:${sel.quantity}`,
    savedAt: '2026-10-01T10:00:00.000Z',
    lastSeen: null,
    refill: null,
    ...extra,
  };
}

/** Price summary from the real bundled pack (no price is invented by the test). */
export function summaryOf(m: Selection) {
  const pack = getPack();
  return priceSummary(pack, pack.nadac, m, 'en', TODAY);
}
