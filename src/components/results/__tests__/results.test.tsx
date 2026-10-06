import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { getPack } from '@/data/pack';
import type { CostPlusStatus } from '@/data/prices';
import { resultsT } from '@/components/results/labels';

import { BuyNowCard } from '../BuyNowCard';
import { CostPlusBlock } from '../CostPlusBlock';
import { CouponCard } from '../CouponCard';
import { resolveSelection } from '../params';
import { ladderModel, PriceLadder } from '../PriceLadder';
import { NadacCard, OutlookCard } from '../ReferenceCards';
import { summaryColumn, summaryHtml, summarySources } from '../summary';
import { APIXABAN, INSULIN, METFORMIN, renderUi, summaryOf, TODAY } from './testUtils';

jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }),
);
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, setParams: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-location', () => ({}));

const pack = getPack();

/** Press, then let the flip's animation callback (run via the worklets mock) finish inside act. */
async function pressAndSettle(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('Price Ladder', () => {
  it('gives no ribbon to a tie (apixaban: two $345 options)', () => {
    const model = ladderModel(summaryOf(APIXABAN));
    expect(model.buys).toHaveLength(2);
    expect(model.ribbon).toBeNull();
    expect(model.buys.every((b) => !b.lowest)).toBe(true);
  });

  it('gives the ribbon only when the lowest price is strictly lower', () => {
    const base = summaryOf(APIXABAN);
    const [a, b] = base.comparable;
    const cheaper = { ...a!, id: 'x-cheaper', priceCents: 30000 };
    const model = ladderModel({ ...base, comparable: [cheaper, b!], lowest: cheaper });
    expect(model.ribbon?.id).toBe('x-cheaper');
    expect(model.buys.find((r) => r.id === 'x-cheaper')?.lowest).toBe(true);
  });

  it('never ranks different versions of a biologic (insulin)', () => {
    const base = summaryOf(INSULIN);
    const extra = { ...base.comparable[0]!, id: 'other-version', priceCents: base.comparable[0]!.priceCents + 1000 };
    const model = ladderModel({ ...base, comparable: [...base.comparable, extra] });
    expect(model.versions).toBe(true);
    expect(model.ribbon).toBeNull();
  });

  it('shows the honest empty state and coupon rows with no dollar amount when nothing is loaded (metformin)', async () => {
    const summary = summaryOf(METFORMIN);
    await renderUi(<PriceLadder summary={summary} selection="500 mg × 60 tablets" />);
    expect(screen.getByText('No checkout price loaded yet for this exact amount')).toBeTruthy();
    expect(screen.getByText('Check price on GoodRx')).toBeTruthy();
    expect(screen.getByText('Check price on SingleCare')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByTestId('ladder-reference')).toBeNull(); // NADAC not loaded → no hatched bar
  });

  it('lists monthly programs apart, without a bar, and says the versions differ (insulin)', async () => {
    await renderUi(<PriceLadder summary={summaryOf(INSULIN)} selection="1 box" />);
    expect(screen.getByTestId('ladder-monthly')).toBeTruthy();
    expect(screen.getByText('$35 per 30-day supply')).toBeTruthy();
    expect(screen.getByTestId('ladder-versions')).toBeTruthy();
    expect(screen.queryByTestId('lowest-ribbon')).toBeNull();
  });
});

describe('Cost Plus status', () => {
  const strength = pack.medications.find((m) => m.id === 'metformin-er')!.strengths[0]!;
  const render = (status: CostPlusStatus) =>
    renderUi(
      <CostPlusBlock status={status} medicationId="metformin-er" strength={strength} quantity={60} onSwitchQuantity={jest.fn()} />,
    );

  it('not loaded: says so, links to Cost Plus, never shows a number', async () => {
    await render({ status: 'notLoaded', url: null });
    expect(screen.getByText('Cost Plus price not loaded yet')).toBeTruthy();
    expect(screen.getByLabelText('Check on Cost Plus')).toBeTruthy();
    expect(screen.queryByText(/\$\d/)).toBeNull();
    expect(screen.getAllByText(/Not yet confirmed — call to confirm/).length).toBeGreaterThan(0);
  });

  it('not listed: says "Not listed on Cost Plus"', async () => {
    await render({ status: 'notListed' });
    expect(screen.getByText('Not listed on Cost Plus')).toBeTruthy();
  });

  it('other quantities: offers quick-switch chips', async () => {
    const onSwitch = jest.fn();
    await renderUi(
      <CostPlusBlock
        status={{ status: 'otherQuantities', quantities: [30, 90], snapshotDate: TODAY }}
        medicationId="metformin-er"
        strength={strength}
        quantity={60}
        onSwitchQuantity={onSwitch}
      />,
    );
    expect(screen.getByText('Cost Plus lists this for 30 tablets, 90 tablets.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('costplus-qty-90'));
    expect(onSwitch).toHaveBeenCalledWith(90);
  });
});

describe('Coupons', () => {
  it('hides a missing partner link and says "Not listed" — and never shows an amount', async () => {
    const med = { ...pack.medications.find((m) => m.id === 'apixaban')!, singleCareUrl: null };
    await renderUi(<CouponCard medication={med} />);
    expect(screen.getByLabelText('See prices on GoodRx')).toBeTruthy();
    expect(screen.queryByLabelText('See prices on SingleCare')).toBeNull();
    expect(screen.getByText('SingleCare: Not listed')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});

describe('Reference and outlook', () => {
  it('NADAC not loaded: honest message, no number', async () => {
    await renderUi(<NadacCard summary={summaryOf(APIXABAN)} />);
    expect(screen.getByText('Reference price not loaded yet. It updates weekly when the app is online.')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('apixaban outlook is hedged, dated and sourced', async () => {
    const summary = summaryOf(APIXABAN);
    await renderUi(<OutlookCard summary={summary} medication={summary.medication} />);
    expect(screen.getByText('A generic version may come out in the next few years. We don\'t know exactly when.')).toBeTruthy();
    expect(screen.getAllByText(/not a promised launch date/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Not yet confirmed — call to confirm/).length).toBeGreaterThan(0);
  });
});

describe('Buy-now card', () => {
  it('flips to the math with the visible "Show the math" button and back', async () => {
    const summary = summaryOf({ ...APIXABAN, perDay: 2 });
    const option = summary.comparable.find((o) => o.id === 'eliquis-bms-60')!;
    await renderUi(<BuyNowCard option={option} strength={summary.strength} perDay={2} formula={pack.costPlus.formula} />);
    expect(screen.getByLabelText('$345')).toBeTruthy();
    await pressAndSettle('show-math-eliquis-bms-60');
    await waitFor(() => expect(screen.getByText('$345 ÷ 60 = $5.75 each')).toBeTruthy());
    expect(screen.getByText('$5.75 × 2 a day × 30 days = $345 per 30 days')).toBeTruthy();
    await pressAndSettle('show-price-eliquis-bms-60');
    await waitFor(() => expect(screen.getByTestId('show-math-eliquis-bms-60')).toBeTruthy());
  });

  it('labels a suggested maximum (CalRx insulin) and leads with the product name', async () => {
    const summary = summaryOf(INSULIN);
    const option = summary.comparable[0]!;
    await renderUi(<BuyNowCard option={option} strength={summary.strength} perDay={null} formula={pack.costPlus.formula} versions />);
    expect(screen.getByText('Suggested maximum price — the pharmacy sets the final price')).toBeTruthy();
    expect(screen.getByText('Up to')).toBeTruthy();
    expect(screen.getByTestId(`buy-now-product-${option.id}`)).toBeTruthy();
  });
});

describe('Route params', () => {
  it('unknown medicine → not found; bad strength/amount → pack defaults', () => {
    expect(resolveSelection(pack, { id: 'nope' }).status).toBe('notFound');
    expect(resolveSelection(pack, { id: '../etc' }).status).toBe('notFound');
    const r = resolveSelection(pack, { id: 'apixaban', strength: 'zzz', qty: '-4', perDay: '9' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.selection).toEqual({ drugId: 'apixaban', strengthId: 'tab-2-5', quantity: 60, perDay: null });
    }
  });
});

describe('Share summary', () => {
  it('escapes text, marks unconfirmed facts, never prints a coupon amount', () => {
    const summary = summaryOf(APIXABAN);
    const col = summaryColumn(pack, summary, resultsT('en'), 'en', { today: TODAY, profile: null });
    const html = summaryHtml([col], summarySources(pack, summary), '<svg></svg>', 'RxBridge-summary');
    expect(html).toContain('<title>RxBridge-summary</title>'); // i18n-ignore
    expect(html).toContain('lang="en-US"');
    expect(html).toContain('Not yet confirmed — call to confirm');
    expect(html).toContain('Bristol Myers Squibb Patient Assistance Foundation');
    expect(html).toContain('https://www.goodrx.com/eliquis');
    expect(html).not.toMatch(/GoodRx[^<]*\$\d/);
    expect(html).not.toContain('Household');

    const evil = summaryColumn(pack, summary, resultsT('en'), 'en', { today: TODAY, profile: null });
    evil.title = '<script>alert(1)</script>';
    expect(summaryHtml([evil], [], '', 'x')).not.toContain('<script>');
  });

  it('adds household and income only when asked', () => {
    const summary = summaryOf(METFORMIN);
    const col = summaryColumn(pack, summary, resultsT('en'), 'en', {
      today: TODAY,
      profile: { householdSize: 2, income: { min: 0, max: 29000 } },
    });
    const profile = col.sections.find((s) => s.id === 'profile');
    expect(profile?.lines.map((l) => l.text)).toEqual(['Household: 2 people', 'Income: under $29,000 a year']);
    expect(col.sections.find((s) => s.id === 'buyNow')?.lines[0]?.text).toBe(
      'No checkout price loaded yet for this exact amount.',
    );
  });
});
