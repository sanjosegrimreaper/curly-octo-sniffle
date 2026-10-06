import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import { getPack } from '@/data/pack';
import { ThemeProvider } from '@/design';
import { evaluateRules, profileFromScreener, thresholdsUsed } from '@/domain';
import { initI18n } from '@/i18n';
import { emptyScreener, type ScreenerValues } from '@/state/screener';

import { BridgeProgress } from '../BridgeProgress';
import { ChoiceCard } from '../ChoiceCard';
import { PeopleRow, peopleRowParts } from '../PeopleRow';
import { ResultCard } from '../ResultCard';
import { stepFor } from '../steps';

// lucide's ESM build isn't transformed by the jest preset; icons are decorative here.
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

const i18n = initI18n('en');

async function renderUi(ui: ReactElement) {
  return await render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider langOverride="en">{ui}</ThemeProvider>
    </I18nextProvider>,
  );
}

describe('Bridge steps follow the current path', () => {
  it('no / not sure path has 6 steps; insured path has 3', () => {
    expect(stepFor('/onboarding/coverage', null)).toMatchObject({ now: 1, total: 6 });
    expect(stepFor('/onboarding/coverage', 'yes')).toMatchObject({ now: 1, total: 3 });
    expect(stepFor('/onboarding/coverage', 'unsure')).toMatchObject({ now: 1, total: 6 });
    expect(stepFor('/onboarding/income', 'no')).toMatchObject({ now: 5, total: 6, name: 'income' });
    expect(stepFor('/onboarding/result', 'no')).toMatchObject({ now: 6, total: 6 });
    expect(stepFor('/onboarding/coverage-type', 'yes')).toMatchObject({ now: 2, total: 3 });
    expect(stepFor('/onboarding/medi-cal', 'yes')).toMatchObject({ now: 3, total: 3, name: 'mediCal' });
  });

  it('is an accessible progress bar ("Step 3 of 6")', async () => {
    await renderUi(<BridgeProgress now={3} total={6} name="age" />);
    const bar = screen.getByTestId('bridge-progress');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 1, max: 6, now: 3, text: 'Step 3 of 6' });
    expect(screen.getByText('Step 3 of 6 · Age', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('ChoiceCard', () => {
  it('has radio semantics and reports its checked state', async () => {
    await renderUi(<ChoiceCard title="Yes" subtitle="I have health coverage" selected onPress={() => {}} testID="c" />);
    const card = screen.getByTestId('c');
    expect(card.props.accessibilityRole).toBe('radio');
    expect(card.props.accessibilityState).toMatchObject({ checked: true, selected: true });
    expect(card.props.accessibilityLabel).toBe('Yes. I have health coverage');
  });
});

describe('PeopleRow', () => {
  it('draws one glyph per person up to 8, then "+N"', async () => {
    expect(peopleRowParts(3)).toEqual({ drawn: 3, extra: 0 });
    expect(peopleRowParts(11)).toEqual({ drawn: 8, extra: 3 });
    expect(peopleRowParts(Number.NaN)).toEqual({ drawn: 0, extra: 0 });
    await renderUi(<PeopleRow count={11} />);
    expect(screen.getAllByTestId('person-glyph', { includeHiddenElements: true })).toHaveLength(8);
    expect(screen.getByText('+3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('is hidden from screen readers (the stepper announces the count)', async () => {
    await renderUi(<PeopleRow count={2} />);
    expect(screen.queryByTestId('people-row')).toBeNull();
    expect(screen.getByTestId('people-row', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('ResultCard (real bundled pack)', () => {
  const pack = getPack();
  const pcts = thresholdsUsed(pack.benefits.rules, pack.programs);
  const resultFor = (s: Partial<ScreenerValues>, id: string) => {
    const profile = profileFromScreener({ ...emptyScreener, ...s }, pack.fpl, pcts);
    const r = evaluateRules(pack.benefits.rules, profile, pack.fpl).find((x) => x.rule.id === id);
    if (!r) throw new Error(`rule ${id} not in pack`);
    return r;
  };

  it('shows the limit for the household, the FPL year, links named for where they go, and the unconfirmed chip', async () => {
    const r = resultFor(
      { coverage: 'no', householdSize: 2, income: { kind: 'bracket', index: 0, householdSize: 2, fplYear: 2026 } },
      'medi-cal-adult',
    );
    expect(r.tier).toBe('mayQualify');
    await renderUi(<ResultCard result={r} householdSize={2} />);
    // 138% × the pack's 2026 guideline for 2, floored to whole dollars.
    const limit = Math.floor((pack.fpl.years.find((y) => y.year === 2026)!.bySize[1]! * 138) / 100);
    expect(screen.getByText(`Up to $${limit.toLocaleString('en-US')} a year for 2 people`)).toBeTruthy();
    expect(screen.getByText('Uses the 2026 federal poverty guidelines.')).toBeTruthy();
    expect(screen.getByText('May qualify')).toBeTruthy();
    expect(screen.getByText('Apply on BenefitsCal')).toBeTruthy();
    // Every pack record in this build is unconfirmed, and the chip never hides it.
    expect(screen.getAllByText(/Not yet confirmed — call to confirm/).length).toBeGreaterThanOrEqual(2);
  });

  it('unknown household → no limit line (never estimated)', async () => {
    const r = resultFor({ coverage: 'no', income: { kind: 'exact', annual: 1000 } }, 'medi-cal-adult');
    await renderUi(<ResultCard result={r} householdSize={null} />);
    expect(screen.queryByText(/a year for/)).toBeNull();
    expect(screen.queryByText('Income limit')).toBeNull();
  });

  it('a little over the limit → says so instead of a tier', async () => {
    const r = resultFor({ coverage: 'no', householdSize: 1, income: { kind: 'exact', annual: 22500 } }, 'medi-cal-adult');
    expect(r.tier).toBe('notLikely');
    await renderUi(<ResultCard result={r} householdSize={1} overLimit />);
    expect(screen.getByText('A little over the limit')).toBeTruthy();
    expect(screen.getByText("You're a little over the limit we show.")).toBeTruthy();
    expect(screen.queryByText('May qualify')).toBeNull();
  });
});
