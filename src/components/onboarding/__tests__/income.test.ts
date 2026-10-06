import { buildBrackets, evaluateRules, profileFromScreener } from '@/domain';
import { FPL, makeRule } from '@/domain/__tests__/fixtures';
import { emptyScreener, type ScreenerValues } from '@/state/screener';

import { parseAmount } from '../AmountField';
import { parseLargeHousehold } from '../HouseholdStepper';
import {
  bracketParts,
  incomeProximity,
  isJustOverLimit,
  limitParts,
  monthlyEdge,
  ruleIncomeEdges,
  ruleUsesIncome,
} from '../income';

// lucide's ESM build isn't transformed by the jest preset; icons are irrelevant here.
jest.mock(
  'lucide-react-native',
  () => new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }),
);
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({ router: {}, useFocusEffect: jest.fn() }));

describe('bracketParts (one label format, exact edges)', () => {
  // FAKE table: 2025 size 1 = $10,000 → 137% = $13,700, 400% = $40,000.
  const brackets = buildBrackets(FPL, 2025, 1, [137, 400]);

  it('labels yearly brackets "$X or less" / "$X+1 to $Y" / "More than $Y"', () => {
    expect(brackets.map((b) => bracketParts(b, 'year'))).toEqual([
      { kind: 'under', max: 13700 },
      { kind: 'range', min: 13701, max: 40000 },
      { kind: 'over', min: 40000 },
    ]);
  });

  it('rounds monthly edges down (annual / 12), so a limit is never overstated', () => {
    expect(monthlyEdge(13700)).toBe(1141); // 1141.67
    expect(brackets.map((b) => bracketParts(b, 'month'))).toEqual([
      { kind: 'under', max: 1141 },
      { kind: 'range', min: 1142, max: 3333 },
      { kind: 'over', min: 3333 },
    ]);
  });

  it('says "any income" when the pack uses no thresholds', () => {
    const [only] = buildBrackets(FPL, 2025, 1, []);
    expect(only && bracketParts(only, 'year')).toEqual({ kind: 'any' });
  });
});

describe('ruleIncomeEdges / limitParts', () => {
  const rule = makeRule({ id: 'r', when: { all: [{ incomePctFplMin: 133.335 }, { incomePctFplMax: 400 }] } });

  it('floors the maximum and rounds the minimum up to the first whole dollar that meets it', () => {
    // 2025 size 1: 133.335% = $13,333.50 → $13,334; 400% = $40,000.
    expect(ruleIncomeEdges(rule, FPL, 2025, 1)).toEqual({ min: 13334, max: 40000 });
    expect(limitParts({ min: 13334, max: 40000 })).toEqual({ kind: 'range', min: 13334, max: 40000 });
  });

  it('unknown household → no limit (unknown stays unknown)', () => {
    expect(ruleIncomeEdges(rule, FPL, 2025, null)).toEqual({ min: null, max: null });
    expect(limitParts({ min: null, max: null })).toBeNull();
  });

  it('ignores a 0% minimum and knows which rules need income', () => {
    const r = makeRule({ id: 'z', when: { all: [{ incomePctFplMin: 0 }, { incomePctFplMax: 138 }] } });
    expect(ruleIncomeEdges(r, FPL, 2026, 1).min).toBeNull();
    expect(ruleUsesIncome(r)).toBe(true);
    expect(ruleUsesIncome(makeRule({ id: 'a', when: { all: [{ age65: 'yes' }] } }))).toBe(false);
  });
});

describe('near a limit', () => {
  // 2026 size 1 = $12,000 → 138% = $16,560.
  const medi = makeRule({ id: 'm', fplYear: 2026, when: { all: [{ insurance: ['none'] }, { incomePctFplMax: 138 }] } });
  const insuredOnly = makeRule({
    id: 'p',
    fplYear: 2026,
    when: { all: [{ insurance: ['private'] }, { incomePctFplMax: 138 }] },
  });
  const run = (annual: number) => {
    const s: ScreenerValues = { ...emptyScreener, coverage: 'no', householdSize: 1, income: { kind: 'exact', annual } };
    return evaluateRules([medi, insuredOnly], profileFromScreener(s, FPL, [138]), FPL);
  };

  it('a little over (≤ 5%) a maximum → "a little over the limit"', () => {
    const results = run(17000);
    const m = results.find((r) => r.rule.id === 'm');
    expect(m && isJustOverLimit(m, FPL, 1, 17000)).toBe(true);
    expect(incomeProximity(results, FPL, 1, 17000)).toEqual({ close: false, over: true });
  });

  it('well over the limit, or failing on something other than income → not "a little over"', () => {
    const results = run(18000);
    expect(incomeProximity(results, FPL, 1, 18000).over).toBe(false);
    const p = run(17000).find((r) => r.rule.id === 'p');
    expect(p && isJustOverLimit(p, FPL, 1, 17000)).toBe(false);
  });

  it('just under a limit → "close to an income limit"', () => {
    expect(incomeProximity(run(16000), FPL, 1, 16000)).toEqual({ close: true, over: false });
  });
});

describe('typed numbers', () => {
  it('parses money with $, commas and cents; rejects junk', () => {
    expect(parseAmount('$1,250.50')).toBe(1250.5);
    expect(parseAmount('25')).toBe(25);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount('12abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });

  it('household "8 or more" accepts 8..20 only', () => {
    expect(parseLargeHousehold('8')).toBe(8);
    expect(parseLargeHousehold(' 20 ')).toBe(20);
    expect(parseLargeHousehold('7')).toBeNull();
    expect(parseLargeHousehold('21')).toBeNull();
    expect(parseLargeHousehold('9.5')).toBeNull();
  });
});
