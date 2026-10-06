import * as fc from 'fast-check';

import type { PricingUnit } from '@/data/schemas';

import {
  budget,
  costPlusQuantities,
  costPlusQuote,
  findNadac,
  isNotListed,
  nadacTotal,
  per30DaysCents,
  per30DaysCentsFromDaily,
  perDayCents,
  perDayCentsFromDaily,
} from '../priceMath';
import { COST_PLUS, makeFeed, makeStrength, nadacEntry, PEN_STRENGTH } from './fixtures';

describe('nadacTotal', () => {
  const tab = makeStrength();

  it('is perUnit × quantity × unitsPerCount, rounded once', () => {
    expect(nadacTotal(nadacEntry({ perUnit: 0.5 }), tab, 30)).toEqual({
      perUnit: 0.5,
      units: 30,
      totalDollars: 15,
      totalCents: 1500,
    });
    const r = nadacTotal(nadacEntry({ perUnit: 0.02792 }), tab, 30)!;
    expect(r.totalDollars).toBeCloseTo(0.8376, 10);
    expect(r.totalCents).toBe(84);
  });

  it('multiplies by unitsPerCount (pens priced per mL)', () => {
    const r = nadacTotal(nadacEntry({ perUnit: 2.5, pricingUnit: 'ML' }), PEN_STRENGTH, 2)!;
    expect(r.units).toBe(30);
    expect(r.totalCents).toBe(7500);
  });

  it('guards float error at the half cent', () => {
    expect(nadacTotal(nadacEntry({ perUnit: 1.005 }), tab, 1)?.totalCents).toBe(101);
    expect(nadacTotal(nadacEntry({ perUnit: 0.1 }), tab, 3)?.totalCents).toBe(30);
  });

  it('is null when missing, on unit mismatch, or for a bad quantity', () => {
    expect(nadacTotal(undefined, tab, 30)).toBeNull();
    expect(nadacTotal(nadacEntry({ pricingUnit: 'ML' }), tab, 30)).toBeNull();
    expect(nadacTotal(nadacEntry({ pricingUnit: 'EA' }), PEN_STRENGTH, 1)).toBeNull();
    expect(nadacTotal(nadacEntry(), tab, 0)).toBeNull();
    expect(nadacTotal(nadacEntry(), tab, -5)).toBeNull();
    expect(nadacTotal(nadacEntry(), tab, NaN)).toBeNull();
  });

  const unit = fc.constantFrom<PricingUnit>('EA', 'ML', 'GM');

  it('never mixes pricing units (property)', () => {
    fc.assert(
      fc.property(
        unit,
        unit,
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 1000 }),
        (a, b, p, q) => {
          const r = nadacTotal(nadacEntry({ pricingUnit: a, perUnit: p }), makeStrength({ pricingUnit: b }), q);
          if (a !== b) expect(r).toBeNull();
          else expect(r).not.toBeNull();
        },
      ),
    );
  });

  it('scales linearly with quantity (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }).map((n) => n / 100_000),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom(1, 3, 15),
        (perUnit, q, k, unitsPerCount) => {
          const s = makeStrength({ unitsPerCount });
          const one = nadacTotal(nadacEntry({ perUnit }), s, q)!;
          const many = nadacTotal(nadacEntry({ perUnit }), s, q * k)!;
          expect(many.units).toBe(one.units * k);
          expect(many.totalDollars).toBeCloseTo(one.totalDollars * k, 6);
          // Rounding happens once, so k separately rounded totals can differ by at most k/2 cents.
          expect(Math.abs(many.totalCents - one.totalCents * k)).toBeLessThanOrEqual(k / 2 + 1e-6);
          // Float noise at large magnitudes (e.g. $99.99842 × 5,250) can sit a hair past .5 of a cent.
          expect(Math.abs(many.totalCents - many.totalDollars * 100)).toBeLessThanOrEqual(0.5 + 1e-6);
        },
      ),
    );
  });
});

describe('findNadac', () => {
  it('finds by key, preferring the latest effective date', () => {
    const feed = makeFeed('2026-01-10', [
      nadacEntry({ key: 'a', perUnit: 1, effectiveDate: '2025-12-01' }),
      nadacEntry({ key: 'a', perUnit: 2, effectiveDate: '2026-01-07' }),
      nadacEntry({ key: 'a', perUnit: 3, effectiveDate: '2025-06-01' }),
      nadacEntry({ key: 'b', perUnit: 9 }),
    ]);
    expect(findNadac(feed, 'a')?.perUnit).toBe(2);
    expect(findNadac(feed, 'b')?.perUnit).toBe(9);
    expect(findNadac(feed, 'zzz')).toBeUndefined();
    expect(findNadac(feed, null)).toBeUndefined();
    expect(findNadac(makeFeed(null, []), 'a')).toBeUndefined();
  });
});

describe('Cost Plus snapshot', () => {
  it('quotes only an exact strength × quantity (never interpolated)', () => {
    expect(costPlusQuote(COST_PLUS, 'test-metformin', 's-tab', 30)?.priceCents).toBe(500);
    expect(costPlusQuote(COST_PLUS, 'test-metformin', 's-tab', 90)?.priceCents).toBe(999);
    expect(costPlusQuote(COST_PLUS, 'test-metformin', 's-tab', 60)).toBeNull();
    expect(costPlusQuote(COST_PLUS, 'test-metformin', 'nope', 30)).toBeNull();
  });

  it('lists quoted quantities ascending', () => {
    expect(costPlusQuantities(COST_PLUS, 'test-metformin', 's-tab')).toEqual([30, 90]);
    expect(costPlusQuantities(COST_PLUS, 'test-metformin', 's-other')).toEqual([30]);
    expect(costPlusQuantities(COST_PLUS, 'test-med-brand', 's-tab')).toEqual([]);
  });

  it('knows what is recorded as not listed (whole drug or one strength)', () => {
    expect(isNotListed(COST_PLUS, 'test-med-brand', 'anything')).toBe(true);
    expect(isNotListed(COST_PLUS, 'test-glargine', 's-pen-2')).toBe(true);
    expect(isNotListed(COST_PLUS, 'test-glargine', 's-pen')).toBe(false);
    expect(isNotListed(COST_PLUS, 'test-metformin', 's-tab')).toBe(false);
  });
});

describe('per-day math', () => {
  it('perDayCents is exact; per30DaysCents rounds once', () => {
    expect(perDayCents(900, 30, 1)).toBe(30);
    expect(perDayCents(1000, 90, 1)).toBeCloseTo(11.1111, 4);
    expect(per30DaysCents(1000, 90, 1)).toBe(333);
    expect(per30DaysCents(999, 90, 1)).toBe(333);
    expect(per30DaysCents(1000, 60, 0.5)).toBe(1000);
    expect(per30DaysCents(1005, 60, 1)).toBe(503);
  });

  it('is null when anything is unknown', () => {
    expect(perDayCents(null, 30, 1)).toBeNull();
    expect(perDayCents(900, 30, null)).toBeNull();
    expect(perDayCents(900, 0, 1)).toBeNull();
    expect(per30DaysCents(900, 30, 0)).toBeNull();
    expect(per30DaysCents(-1, 30, 1)).toBeNull();
  });

  it('daily-dose variants use days = quantity / unitsPerDay', () => {
    expect(perDayCentsFromDaily(900, 30, 2)).toBe(60);
    expect(per30DaysCentsFromDaily(900, 30, 2)).toBe(1800);
    expect(per30DaysCentsFromDaily(1000, 90, 1)).toBe(333);
    expect(per30DaysCentsFromDaily(1000, 90, 0.5)).toBe(167);
  });

  it('daily-dose variants are null for unknown or zero doses', () => {
    expect(perDayCentsFromDaily(900, 30, null)).toBeNull();
    expect(perDayCentsFromDaily(900, 30, 0)).toBeNull();
    expect(per30DaysCentsFromDaily(900, 30, -1)).toBeNull();
    expect(per30DaysCentsFromDaily(null, 30, 1)).toBeNull();
    expect(per30DaysCentsFromDaily(900, 0, 1)).toBeNull();
  });

  it('both forms agree when unitsPerDay = 1 / daysPerCount (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 365 }),
        fc.constantFrom(0.5, 1, 2, 4),
        (p, q, upd) => {
          expect(per30DaysCentsFromDaily(p, q, upd)).toBe(per30DaysCents(p, q, 1 / upd));
        },
      ),
    );
  });
});

describe('budget', () => {
  it('sums known items per 30 days and counts unknowns', () => {
    expect(
      budget([
        { priceCents: 999, quantity: 90, daysPerCount: 1 },
        { priceCents: null, quantity: 30, daysPerCount: 1 },
        { priceCents: 500, quantity: 30, daysPerCount: null },
      ]),
    ).toEqual({ monthlyCents: 333, known: 1, unknown: 2 });
  });

  it('rounds once at the end, not per item', () => {
    const third = { priceCents: 100, quantity: 90, daysPerCount: 1 }; // 33.33… cents a month
    expect(budget([third, third]).monthlyCents).toBe(67);
    expect(budget([third, third, third]).monthlyCents).toBe(100);
  });

  it('is zero for nothing', () => {
    expect(budget([])).toEqual({ monthlyCents: 0, known: 0, unknown: 0 });
  });
});
