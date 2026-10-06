import * as fc from 'fast-check';

import { displayLimit, fplYearRow, guidelineFor, latestYear, pctOfFpl, thresholdDollars, yearOrLatest } from '../fpl';
import { FPL } from './fixtures';

describe('guidelineFor', () => {
  it('reads listed household sizes 1..8', () => {
    expect(guidelineFor(FPL, 2025, 1)).toBe(10000);
    expect(guidelineFor(FPL, 2025, 8)).toBe(45000);
    expect(guidelineFor(FPL, 2026, 1)).toBe(12000);
    expect(guidelineFor(FPL, 2026, 3)).toBe(24000);
  });

  it('derives sizes above 8 from the per-additional amount', () => {
    expect(guidelineFor(FPL, 2025, 9)).toBe(50000);
    expect(guidelineFor(FPL, 2025, 12)).toBe(65000);
    expect(guidelineFor(FPL, 2026, 20)).toBe(54000 + 6000 * 12);
  });

  it('returns null for unknown years and invalid sizes', () => {
    expect(guidelineFor(FPL, 2099, 1)).toBeNull();
    expect(guidelineFor(FPL, 2026, 0)).toBeNull();
    expect(guidelineFor(FPL, 2026, -1)).toBeNull();
    expect(guidelineFor(FPL, 2026, 1.5)).toBeNull();
    expect(guidelineFor(FPL, 2026, NaN)).toBeNull();
  });
});

describe('fplYearRow / latestYear / yearOrLatest', () => {
  it('finds rows and the latest year', () => {
    expect(fplYearRow(FPL, 2025)?.year).toBe(2025);
    expect(fplYearRow(FPL, 2024)).toBeUndefined();
    expect(latestYear(FPL)).toBe(2026);
  });

  it('prefers a year the table carries, else the latest', () => {
    expect(yearOrLatest(FPL, 2025)).toBe(2025);
    expect(yearOrLatest(FPL, 2030)).toBe(2026);
    expect(yearOrLatest(FPL, null)).toBe(2026);
  });
});

describe('thresholdDollars', () => {
  it('is guideline × pct / 100', () => {
    expect(thresholdDollars(FPL, 2026, 1, 150)).toBe(18000);
    expect(thresholdDollars(FPL, 2025, 2, 138)).toBe(20700);
    expect(thresholdDollars(FPL, 2026, 1, 0)).toBe(0);
  });

  it('rounds once to cents (half up, without float noise)', () => {
    expect(thresholdDollars(FPL, 2025, 1, 33.33333)).toBe(3333.33);
    expect(thresholdDollars(FPL, 2025, 1, 138.005)).toBe(13800.5);
    expect(thresholdDollars(FPL, 2025, 1, 0.00005)).toBe(0.01);
  });

  it('returns null for unknown guidelines or invalid percents', () => {
    expect(thresholdDollars(FPL, 2099, 1, 100)).toBeNull();
    expect(thresholdDollars(FPL, 2026, 0, 100)).toBeNull();
    expect(thresholdDollars(FPL, 2026, 1, -1)).toBeNull();
    expect(thresholdDollars(FPL, 2026, 1, NaN)).toBeNull();
  });

  it('is monotonic in household size and in percent (sizes 1-20)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2025, 2026),
        fc.integer({ min: 1, max: 19 }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (year, size, a, b) => {
          const pa = a / 100;
          const pb = b / 100;
          const t = (s: number, p: number) => thresholdDollars(FPL, year, s, p)!;
          expect(t(size + 1, pa)).toBeGreaterThanOrEqual(t(size, pa));
          if (pa <= pb) expect(t(size, pa)).toBeLessThanOrEqual(t(size, pb));
          else expect(t(size, pa)).toBeGreaterThanOrEqual(t(size, pb));
        },
      ),
    );
  });

  it('always has at most 2 decimals', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.double({ min: 0, max: 1000, noNaN: true }), (size, pct) => {
        const t = thresholdDollars(FPL, 2026, size, pct)!;
        expect(Math.abs(t * 100 - Math.round(t * 100))).toBeLessThan(1e-6);
      }),
    );
  });
});

describe('displayLimit', () => {
  it('floors to whole dollars so "up to $X" never overstates', () => {
    expect(displayLimit(20783.5)).toBe(20783);
    expect(displayLimit(20783.99)).toBe(20783);
    expect(displayLimit(16560)).toBe(16560);
    expect(displayLimit(0.99)).toBe(0);
  });

  it('ignores binary float noise just under a whole dollar', () => {
    expect(displayLimit(16559.999999999996)).toBe(16560);
  });
});

describe('pctOfFpl', () => {
  it('is income / guideline × 100', () => {
    expect(pctOfFpl(FPL, 2026, 1, 12000)).toBe(100);
    expect(pctOfFpl(FPL, 2026, 1, 6000)).toBe(50);
    expect(pctOfFpl(FPL, 2026, 2, 27000)).toBe(150);
  });

  it('returns null when unknown', () => {
    expect(pctOfFpl(FPL, 2099, 1, 1000)).toBeNull();
    expect(pctOfFpl(FPL, 2026, 0, 1000)).toBeNull();
    expect(pctOfFpl(FPL, 2026, 1, -1)).toBeNull();
    expect(pctOfFpl(FPL, 2026, 1, Infinity)).toBeNull();
  });
});
