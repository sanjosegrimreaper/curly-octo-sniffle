import * as fc from 'fast-check';

import {
  bracketForIncome,
  buildBrackets,
  fromAnnual,
  incomeRangeOf,
  normalizePcts,
  thresholdLadder,
  thresholdsUsed,
  toAnnual,
  type Bracket,
  type IncomeRange,
} from '../brackets';
import { FPL, makeProgram, makeRule, PROGRAMS, RULES } from './fixtures';

describe('normalizePcts', () => {
  it('keeps finite positive percents, unique and sorted', () => {
    expect(normalizePcts([300, 150, 150, 0, -5, NaN, Infinity, 138])).toEqual([138, 150, 300]);
    expect(normalizePcts([])).toEqual([]);
  });
});

describe('thresholdLadder', () => {
  it('lists exact dollar thresholds for the household', () => {
    expect(thresholdLadder(FPL, 2026, 1, [300, 150])).toEqual([
      { pct: 150, dollars: 18000 },
      { pct: 300, dollars: 36000 },
    ]);
  });

  it('collapses percents that land on the same dollar amount', () => {
    expect(thresholdLadder(FPL, 2026, 1, [150, 150.00001])).toEqual([{ pct: 150, dollars: 18000 }]);
  });

  it('is null when the year or size is unknown', () => {
    expect(thresholdLadder(FPL, 2099, 1, [150])).toBeNull();
    expect(thresholdLadder(FPL, 2026, 0, [150])).toBeNull();
  });
});

describe('buildBrackets', () => {
  it('builds N+1 brackets with exact and display edges', () => {
    expect(buildBrackets(FPL, 2026, 1, [300, 150])).toEqual<Bracket[]>([
      { index: 0, minPct: null, maxPct: 150, minDollars: null, maxDollars: 18000, minExact: null, maxExact: 18000 },
      { index: 1, minPct: 150, maxPct: 300, minDollars: 18000, maxDollars: 36000, minExact: 18000, maxExact: 36000 },
      { index: 2, minPct: 300, maxPct: null, minDollars: 36000, maxDollars: null, minExact: 36000, maxExact: null },
    ]);
  });

  it('floors display edges but keeps exact edges', () => {
    const [first, second] = buildBrackets(FPL, 2025, 1, [138.005]);
    expect(first?.maxExact).toBe(13800.5);
    expect(first?.maxDollars).toBe(13800);
    expect(second?.minDollars).toBe(13800);
  });

  it('gives one open bracket when there are no thresholds', () => {
    expect(buildBrackets(FPL, 2026, 3, [])).toEqual([
      { index: 0, minPct: null, maxPct: null, minDollars: null, maxDollars: null, minExact: null, maxExact: null },
    ]);
  });

  it('is empty when the year or size is unknown', () => {
    expect(buildBrackets(FPL, 2099, 1, [150])).toEqual([]);
    expect(buildBrackets(FPL, 2026, 0, [150])).toEqual([]);
  });

  it('supports households above 8', () => {
    const b = buildBrackets(FPL, 2026, 12, [100]);
    expect(b[0]?.maxExact).toBe(54000 + 6000 * 4);
  });
});

describe('bracketForIncome', () => {
  it('puts edges in the bracket below', () => {
    const at = (x: number) => bracketForIncome(FPL, 2026, 1, [150, 300], x);
    expect(at(0)).toBe(0);
    expect(at(18000)).toBe(0);
    expect(at(18000.01)).toBe(1);
    expect(at(36000)).toBe(1);
    expect(at(36000.01)).toBe(2);
    expect(at(1e9)).toBe(2);
  });

  it('is null when unknown', () => {
    expect(bracketForIncome(FPL, 2099, 1, [150], 100)).toBeNull();
    expect(bracketForIncome(FPL, 2026, 1, [150], -1)).toBeNull();
    expect(bracketForIncome(FPL, 2026, 1, [150], NaN)).toBeNull();
  });
});

describe('thresholdsUsed', () => {
  it('collects rule limits and published program caps', () => {
    expect(thresholdsUsed(RULES, PROGRAMS)).toEqual([120, 150, 300, 400]);
  });

  it('ignores unpublished caps, non-income conditions and 0% minimums', () => {
    const rules = [makeRule({ id: 'r', when: { all: [{ incomePctFplMin: 0 }, { age65: 'yes' }, { county: ['x'] }] } })];
    expect(thresholdsUsed(rules, [makeProgram({ id: 'p', fplMax: null })])).toEqual([]);
  });
});

describe('incomeRangeOf', () => {
  const pcts = [150, 300];

  it('keeps unknown income unknown', () => {
    expect(incomeRangeOf(null, FPL, pcts)).toBeNull();
    expect(incomeRangeOf({ kind: 'skip' }, FPL, pcts)).toBeNull();
    expect(incomeRangeOf({ kind: 'exact', annual: -1 }, FPL, pcts)).toBeNull();
    expect(incomeRangeOf({ kind: 'exact', annual: NaN }, FPL, pcts)).toBeNull();
  });

  it('turns an exact income into a point range', () => {
    expect(incomeRangeOf({ kind: 'exact', annual: 20000 }, FPL, pcts)).toEqual({ min: 20000, max: 20000 });
  });

  it('turns a bracket into its exact dollar range', () => {
    const b = (index: number) => incomeRangeOf({ kind: 'bracket', index, householdSize: 1, fplYear: 2026 }, FPL, pcts);
    expect(b(0)).toEqual({ min: 0, max: 18000 });
    expect(b(1)).toEqual({ min: 18000, max: 36000, minExclusive: true });
    expect(b(2)).toEqual({ min: 36000, max: null, minExclusive: true });
    expect(b(3)).toBeNull();
    expect(b(-1)).toBeNull();
  });

  it('is null when the bracket year is no longer in the table', () => {
    expect(incomeRangeOf({ kind: 'bracket', index: 0, householdSize: 1, fplYear: 2001 }, FPL, pcts)).toBeNull();
  });
});

describe('toAnnual / fromAnnual', () => {
  it('converts without rounding', () => {
    expect(toAnnual(1000, 'month')).toBe(12000);
    expect(toAnnual(1000, 'year')).toBe(1000);
    expect(fromAnnual(12000, 'month')).toBe(1000);
    expect(fromAnnual(1000, 'month')).toBeCloseTo(83.3333, 4);
    expect(fromAnnual(1000, 'year')).toBe(1000);
  });
});

describe('bracket properties (household 1-20, random threshold sets)', () => {
  const contains = (r: IncomeRange, x: number) =>
    (r.minExclusive ? x > r.min : x >= r.min) && (r.max === null || x <= r.max);

  const arb = fc.record({
    year: fc.constantFrom(2025, 2026),
    size: fc.integer({ min: 1, max: 20 }),
    pcts: fc.array(fc.integer({ min: 1, max: 1000 }), { maxLength: 8 }),
  });

  it('edges are contiguous: first starts at $0, last is open, each max is the next min', () => {
    fc.assert(
      fc.property(arb, ({ year, size, pcts }) => {
        const brackets = buildBrackets(FPL, year, size, pcts);
        expect(brackets.length).toBe(new Set(pcts).size + 1);
        expect(brackets[0]?.minExact).toBeNull();
        expect(brackets[brackets.length - 1]?.maxExact).toBeNull();
        brackets.forEach((b, i) => {
          expect(b.index).toBe(i);
          const next = brackets[i + 1];
          if (next) {
            expect(next.minExact).toBe(b.maxExact);
            expect(next.minPct).toBe(b.maxPct);
            expect(next.minDollars).toBe(b.maxDollars);
            expect(b.maxExact!).toBeGreaterThan(b.minExact ?? -Infinity);
            expect(b.maxDollars).toBe(Math.floor(b.maxExact!));
          }
        });
      }),
    );
  });

  it('every income falls in exactly one bracket (no gaps, no overlaps)', () => {
    fc.assert(
      fc.property(arb, fc.integer({ min: 0, max: 200_000_000 }), ({ year, size, pcts }, cents) => {
        const income = cents / 100;
        const brackets = buildBrackets(FPL, year, size, pcts);
        const ranges = brackets.map((b) =>
          incomeRangeOf({ kind: 'bracket', index: b.index, householdSize: size, fplYear: year }, FPL, pcts)!,
        );
        const hits = ranges.flatMap((r, i) => (contains(r, income) ? [i] : []));
        expect(hits).toHaveLength(1);
        expect(hits[0]).toBe(bracketForIncome(FPL, year, size, pcts, income));
      }),
    );
  });

  it('threshold edges themselves belong to the bracket below', () => {
    fc.assert(
      fc.property(arb, ({ year, size, pcts }) => {
        const ladder = thresholdLadder(FPL, year, size, pcts)!;
        ladder.forEach((t, i) => {
          expect(bracketForIncome(FPL, year, size, pcts, t.dollars)).toBe(i);
          expect(bracketForIncome(FPL, year, size, pcts, t.dollars + 0.01)).toBe(i + 1);
        });
      }),
    );
  });
});
