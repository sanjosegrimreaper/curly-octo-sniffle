import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import { getPack } from '@/data/pack';
import { priceSummary, type PriceSummary } from '@/data/prices';
import { ThemeProvider } from '@/design';
import { initI18n } from '@/i18n';
import type { Selection } from '@/state/medicines';

export const TODAY = '2026-10-06';
const i18n = initI18n('en');

export async function renderUi(ui: ReactElement) {
  return await render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider langOverride="en">{ui}</ThemeProvider>
    </I18nextProvider>,
  );
}

/** Price summary from the real bundled pack (the tests never invent a price). */
export function summaryOf(sel: Selection): PriceSummary {
  const pack = getPack();
  const s = priceSummary(pack, pack.nadac, sel, 'en', TODAY);
  if (!s) throw new Error(`No summary for ${sel.drugId}`);
  return s;
}

export const APIXABAN: Selection = { drugId: 'apixaban', strengthId: 'tab-5', quantity: 60 };
export const INSULIN: Selection = { drugId: 'insulin-glargine', strengthId: 'pens-5x3', quantity: 1 };
export const METFORMIN: Selection = { drugId: 'metformin-er', strengthId: 'er-500', quantity: 60 };
