import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import type { Program } from '@/data/schemas';
import { ThemeProvider } from '@/design';
import { matchProgram, type Profile } from '@/domain';
import { FPL } from '@/domain/__tests__/fixtures';
import { initI18n } from '@/i18n';
import { emptyScreener, useScreener } from '@/state/screener';

import { HelpPayingTab } from '../HelpPayingTab';
import { ProgramCard } from '../ProgramCard';

// lucide's ESM build isn't transformed by the jest preset; icons are decorative here.
jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }),
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

const SOURCES: Program['sources'] = [
  { name: 'Test Source (fake)', url: 'https://example.org/source', method: 'unconfirmed', checkedOn: '2026-01-15' },
];

/** FAKE program for tests — not a real program. */
function fakeProgram(overrides: Partial<Program>): Program {
  return {
    id: 'test-program',
    kind: 'manufacturerPap',
    name: 'Test Program (fake)',
    sponsor: 'Test Sponsor',
    description: { en: 'A fake program for tests.' },
    medicationIds: ['apixaban'],
    fplMax: 400,
    fplYear: 2026,
    insuranceRule: 'uninsuredOnly',
    insuranceRuleText: { en: 'Fake insurance rule.' },
    closedToNew: false,
    applicationUrl: 'https://example.org/apply',
    phone: '1-800-555-0100',
    interpreterAvailable: null,
    documents: [{ en: 'Doc one' }, { en: 'Doc two' }, { en: 'Doc three' }, { en: 'Doc four' }],
    sendWhere: null,
    termMonths: null,
    cutoffNote: null,
    sources: SOURCES,
    verifiedAsOf: '2026-01-15',
    ...overrides,
  };
}

const profile = (p: Partial<Profile>): Profile => ({
  insurance: 'none',
  age65: null,
  county: null,
  householdSize: 1,
  income: { min: 0, max: 10000 },
  ...p,
});

beforeEach(() => {
  useScreener.setState({ ...emptyScreener, householdSize: 1 });
});

describe('ProgramCard', () => {
  it('says the income limit is not published when there is no cap, and keeps the cutoff note', async () => {
    const program = fakeProgram({ fplMax: null, fplYear: null, cutoffNote: { en: 'Fake cutoff note.' } });
    await renderUi(<ProgramCard match={matchProgram(program, profile({}), FPL)} />);
    expect(screen.getByText('Not published — call to confirm')).toBeTruthy();
    expect(screen.getByText('Fake cutoff note.')).toBeTruthy();
    // No income-fit line when the program publishes no cap.
    expect(screen.queryByTestId('program-income-fit-test-program')).toBeNull();
  });

  it('shows the cap in % FPL and dollars for the household, with the income fit', async () => {
    const program = fakeProgram({});
    await renderUi(<ProgramCard match={matchProgram(program, profile({}), FPL)} />);
    // Fixture FPL 2026, 1 person = $12,000 → 400% = $48,000.
    expect(screen.getByText('$48,000 a year')).toBeTruthy();
    expect(screen.getByText('400% of the poverty level for 1 person · 2026 guidelines')).toBeTruthy();
    expect(screen.getByText('Your income range is under the limit')).toBeTruthy();
  });

  it('asks for income when it is unknown', async () => {
    await renderUi(<ProgramCard match={matchProgram(fakeProgram({}), profile({ income: null }), FPL)} />);
    expect(screen.getByText('Add your income to check')).toBeTruthy();
  });

  it('shows the closed badge for programs not taking new people', async () => {
    await renderUi(<ProgramCard match={matchProgram(fakeProgram({ closedToNew: true }), profile({}), FPL)} />);
    expect(screen.getByText('Not taking new people right now')).toBeTruthy();
  });

  it.each([
    ['uninsuredOnly', 'none', 'Your coverage fits'],
    ['uninsuredOnly', 'unsure', 'Check the coverage rules'],
    ['uninsuredOnly', 'medi-cal', 'Your coverage may not fit'],
  ] as const)('rule %s + %s → "%s"', async (rule, insurance, label) => {
    await renderUi(<ProgramCard match={matchProgram(fakeProgram({ insuranceRule: rule }), profile({ insurance }), FPL)} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('previews two documents and counts the rest', async () => {
    await renderUi(<ProgramCard match={matchProgram(fakeProgram({}), profile({}), FPL)} />);
    expect(screen.getByText('Doc one')).toBeTruthy();
    expect(screen.getByText('Doc two')).toBeTruthy();
    expect(screen.queryByText('Doc three')).toBeNull();
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  it('always shows the source chip as not yet confirmed', async () => {
    await renderUi(<ProgramCard match={matchProgram(fakeProgram({}), profile({}), FPL)} />);
    expect(screen.getByText(/Not yet confirmed — call to confirm/)).toBeTruthy();
  });
});

describe('HelpPayingTab', () => {
  it('shows an honest empty state for a generic medicine with no programs', async () => {
    await renderUi(<HelpPayingTab medicationId="metformin-er" />);
    expect(screen.getByTestId('help-paying-empty')).toBeTruthy();
    expect(screen.getByText("We didn't find a drug company program taking new people for this medicine.")).toBeTruthy();
    expect(
      screen.getByText("Most generic medicines don't have a drug company help program. The Buy-now price may be your best option."),
    ).toBeTruthy();
    expect(screen.getByText('Get free help')).toBeTruthy();
  });

  it('asks for household and income when they were skipped', async () => {
    useScreener.setState({ ...emptyScreener, coverage: 'no', income: { kind: 'skip' } });
    await renderUi(<HelpPayingTab medicationId="apixaban" />);
    expect(screen.getByText('Add your household and income to see which programs fit')).toBeTruthy();
  });

  it('warns when program listings are more than 6 months old', async () => {
    // Only fake the clock's date: pack programs were checked in Oct 2026.
    jest.useFakeTimers({
      now: new Date(2027, 5, 1),
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
    });
    try {
      await renderUi(<HelpPayingTab medicationId="insulin-glargine" />);
      expect(screen.getByTestId('help-paying-stale')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not warn about staleness for fresh listings', async () => {
    await renderUi(<HelpPayingTab medicationId="insulin-glargine" />);
    expect(screen.queryByTestId('help-paying-stale')).toBeNull();
  });

  it('handles an unknown medicine', async () => {
    await renderUi(<HelpPayingTab medicationId="not-a-medicine" />);
    expect(screen.getByTestId('help-paying-unknown')).toBeTruthy();
  });
});
