import { screen } from '@testing-library/react-native';

import { BudgetCard } from '../BudgetCard';
import { budgetView } from '../budgetView';
import { MedicineCard } from '../MedicineCard';
import { renderUi, saved, summaryOf } from './testUtils';

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
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-notifications', () => ({}));

const apixaban = saved({ drugId: 'apixaban', strengthId: 'tab-5', quantity: 60 });
const insulin = saved({ drugId: 'insulin-glargine', strengthId: 'pens-5x3', quantity: 1 });
const metformin = saved({ drugId: 'metformin-er', strengthId: 'er-500', quantity: 60 });

describe('MedicineCard', () => {
  it('keeps a medicine that is no longer in the pack, with Search and Remove', async () => {
    const gone = saved({ drugId: 'no-such-drug', strengthId: 'x', quantity: 30 });
    await renderUi(<MedicineCard medicine={gone} summary={summaryOf(gone)} />);
    expect(screen.getByText('No longer in our list — search again')).toBeTruthy();
    expect(screen.getByLabelText('Search again')).toBeTruthy();
    expect(screen.getByLabelText('Remove no-such-drug')).toBeTruthy();
  });

  it('says "No checkout price loaded yet" and shows no dollar amount when there is no Buy-now price', async () => {
    await renderUi(<MedicineCard medicine={metformin} summary={summaryOf(metformin)} />);
    expect(screen.getByText('No checkout price loaded yet')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows the lowest Buy-now price with its unconfirmed source chip and badges', async () => {
    await renderUi(<MedicineCard medicine={apixaban} summary={summaryOf(apixaban)} />);
    expect(screen.getByText('$345')).toBeTruthy();
    expect(screen.getByText('Generic may come 2028')).toBeTruthy();
    expect(screen.getByText('Has a help program')).toBeTruthy();
    expect(screen.getAllByText(/Not yet confirmed — call to confirm/).length).toBeGreaterThan(0);
  });

  it('labels a maximum price as "Up to", never as an exact price', async () => {
    await renderUi(<MedicineCard medicine={insulin} summary={summaryOf(insulin)} />);
    expect(screen.getByText('Up to $55')).toBeTruthy();
    expect(screen.queryByText('Generic may come', { exact: false })).toBeNull();
  });
});

describe('BudgetCard', () => {
  it('never guesses: no total until the fill length is known', async () => {
    const meds = [apixaban, insulin];
    const view = budgetView(meds, meds.map(summaryOf));
    expect(view.known).toBe(0);
    await renderUi(<BudgetCard view={view} />);
    expect(screen.getByText('No monthly total yet')).toBeTruthy();
    expect(screen.getByText('+ 2 more once you tell us how long a fill lasts')).toBeTruthy();
    expect(screen.queryByText(/a month/)).toBeNull();
  });

  it('adds only listed Buy-now prices and counts medicines without one', async () => {
    const withDays = { ...apixaban, perDay: 2 }; // 60 tablets last 30 days
    const meds = [withDays, metformin];
    const view = budgetView(meds, meds.map(summaryOf));
    expect(view).toMatchObject({ monthlyCents: 34500, known: 1, noPrice: 1, needDays: 0 });
    await renderUi(<BudgetCard view={view} />);
    expect(screen.getByText('$345 a month')).toBeTruthy();
    expect(screen.getByText('for 1 medicine')).toBeTruthy();
    expect(screen.getByText('+ 1 without a listed price')).toBeTruthy();
  });

  it('says "Up to" when the total includes a most-you-may-pay price', async () => {
    const withDays = { ...insulin, perDay: 1 / 30 }; // one box lasts 30 days
    const view = budgetView([withDays], [summaryOf(withDays)]);
    await renderUi(<BudgetCard view={view} />);
    expect(screen.getByText('Up to $55 a month')).toBeTruthy();
    expect(screen.getByText(/your total may be lower/)).toBeTruthy();
  });

  it('counts a medicine missing from the pack as "without a listed price"', () => {
    const gone = saved({ drugId: 'no-such-drug', strengthId: 'x', quantity: 30 });
    const view = budgetView([gone], [summaryOf(gone)]);
    expect(view).toMatchObject({ monthlyCents: 0, known: 0, noPrice: 1 });
  });
});
