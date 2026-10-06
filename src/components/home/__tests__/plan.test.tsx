import { screen } from '@testing-library/react-native';
import type { TFunction } from 'i18next';

import { getPack } from '@/data/pack';
import type { PriceSummary } from '@/data/prices';
import { i18next } from '@/i18n';

import { priceChanges, staleLastSeen } from '../changes';
import { PlanStepCard } from '../PlanStepCard';
import { describeStep, summaryKey, type StepContext } from '../planSteps';
import { renderUi, saved, summaryOf, TODAY } from './testUtils';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }),
);
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useFocusEffect: jest.fn(),
}));

const insulin = saved({ drugId: 'insulin-glargine', strengthId: 'pens-5x3', quantity: 1 });

function ctx(summaries: PriceSummary[] = []): StepContext {
  const map = new Map(summaries.map((s) => [summaryKey(s.medication.id, s.strength.id, s.quantity), s]));
  return { t: i18next.getFixedT('en', 'plan') as TFunction<'plan'>, lang: 'en', pack: getPack(), summaries: map, today: TODAY };
}

describe('describeStep', () => {
  it('drops a step whose record is missing from the pack', () => {
    expect(describeStep({ kind: 'applyBenefit', ruleId: 'no-such-rule', programKey: 'medi-cal' }, ctx())).toBeNull();
    expect(describeStep({ kind: 'callProgram', programId: 'nope', drugId: 'apixaban' }, ctx())).toBeNull();
  });

  it('routes each step to the place where it gets done', () => {
    expect(describeStep({ kind: 'finishScreener' }, ctx())?.href).toBe('/onboarding/coverage');
    expect(describeStep({ kind: 'checkMedicare' }, ctx())?.href).toBe('/medicare');
    expect(describeStep({ kind: 'findMedicine' }, ctx())?.href).toBe('/find');
    expect(describeStep({ kind: 'callProgram', programId: 'lilly-cares', drugId: 'insulin-glargine' }, ctx())?.href).toBe(
      '/call-coach/lilly-cares?drug=insulin-glargine',
    );
  });

  it('renders a buy-now step as a priced card: "Up to" for a maximum price, with a source chip', async () => {
    const s = summaryOf(insulin);
    if (!s?.lowest) throw new Error('expected a Buy-now price in the pack');
    const view = describeStep(
      {
        kind: 'buyNow',
        drugId: insulin.drugId,
        strengthId: insulin.strengthId,
        quantity: 1,
        priceCents: s.lowest.priceCents,
        seller: s.lowest.seller,
      },
      ctx([s]),
    );
    expect(view?.href).toBe('/drug/insulin-glargine/results?strength=pens-5x3&qty=1');
    if (!view) throw new Error('expected a step');
    await renderUi(<PlanStepCard view={view} index={0} total={1} />);
    expect(screen.getByText('Up to $55')).toBeTruthy();
    expect(screen.getByText('Listed price')).toBeTruthy();
    expect(screen.getByText(/Not yet confirmed — call to confirm/)).toBeTruthy();
  });

  it('says when a renewal date has passed', () => {
    const view = describeStep({ kind: 'renew', programId: 'lilly-cares', renewBy: '2026-09-01' }, ctx());
    expect(view?.body).toBe('This date has passed. Call the program to ask what to do.');
  });
});

describe('changes since last visit', () => {
  it('reports only real changes in the Buy-now price', () => {
    const s = summaryOf(insulin);
    const same = saved(insulin, { lastSeen: { priceCents: 5500, snapshotDate: TODAY } });
    const changed = saved(insulin, { lastSeen: { priceCents: 6000, snapshotDate: '2026-09-01' } });
    const never = saved(insulin, { lastSeen: null });
    expect(priceChanges([same], [s])).toEqual([]);
    expect(priceChanges([never], [s])).toEqual([]);
    expect(priceChanges([changed], [s])).toMatchObject([{ fromCents: 6000, toCents: 5500 }]);
  });

  it('remembers today\'s price, and never for a medicine without one', () => {
    const metformin = saved({ drugId: 'metformin-er', strengthId: 'er-500', quantity: 60 });
    expect(staleLastSeen([metformin], [summaryOf(metformin)])).toEqual([]);
    expect(staleLastSeen([insulin], [summaryOf(insulin)])).toMatchObject([{ key: insulin.key, lastSeen: { priceCents: 5500 } }]);
  });
});
