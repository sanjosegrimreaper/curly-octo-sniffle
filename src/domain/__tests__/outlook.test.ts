import * as fc from 'fast-check';

import { addMonths, formatISODate, parseISODate } from '../dates';
import { monthsBetween, outlookTier, type OutlookTier } from '../outlook';
import { makeOutlook } from './fixtures';

describe('monthsBetween', () => {
  it('counts whole calendar months, floored', () => {
    expect(monthsBetween('2026-01-15', '2026-01-15')).toBe(0);
    expect(monthsBetween('2026-01-15', '2026-02-14')).toBe(0);
    expect(monthsBetween('2026-01-15', '2026-02-15')).toBe(1);
    expect(monthsBetween('2026-01-15', '2027-01-14')).toBe(11);
    expect(monthsBetween('2026-01-15', '2027-01-15')).toBe(12);
    expect(monthsBetween('2026-12-31', '2027-01-01')).toBe(0);
  });

  it('clamps month ends (Jan 31 → Feb 28 is one month)', () => {
    expect(monthsBetween('2026-01-31', '2026-02-27')).toBe(0);
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(1);
    expect(monthsBetween('2028-01-31', '2028-02-28')).toBe(0);
    expect(monthsBetween('2028-01-31', '2028-02-29')).toBe(1);
  });

  it('handles the leap day 2028-02-29', () => {
    expect(monthsBetween('2028-02-29', '2029-02-27')).toBe(11);
    expect(monthsBetween('2028-02-29', '2029-02-28')).toBe(12);
    expect(monthsBetween('2027-02-28', '2028-02-29')).toBe(12);
    expect(monthsBetween('2028-02-29', '2032-02-29')).toBe(48);
  });

  it('is negative backwards, NaN for invalid dates', () => {
    expect(monthsBetween('2027-01-15', '2026-01-15')).toBe(-12);
    expect(Object.is(monthsBetween('2026-01-16', '2026-01-15'), 0)).toBe(true);
    expect(monthsBetween('2026-02-30', '2026-03-01')).toBeNaN();
    expect(monthsBetween('soon', '2026-03-01')).toBeNaN();
  });

  it('is monotonic in the end date (property)', () => {
    const day = fc
      .integer({ min: 0, max: 20000 })
      .map((n) => new Date(Date.UTC(2000, 0, 1) + n * 86400000).toISOString().slice(0, 10));
    fc.assert(
      fc.property(day, day, day, (a, b, c) => {
        const [lo, hi] = b <= c ? [b, c] : [c, b];
        expect(monthsBetween(a, lo)).toBeLessThanOrEqual(monthsBetween(a, hi));
      }),
    );
  });
});

describe('outlookTier', () => {
  const tier = (earliestDate: string | null, today: string) => outlookTier(makeOutlook({ earliestDate }), today);

  it('unknown without a record, date or valid date', () => {
    expect(outlookTier(undefined, '2026-10-06')).toEqual({ tier: 'unknown', months: null });
    expect(tier(null, '2026-10-06')).toEqual({ tier: 'unknown', months: null });
    expect(tier('2027-02-30', '2026-10-06')).toEqual({ tier: 'unknown', months: null });
    expect(tier('2027-01-01', 'today')).toEqual({ tier: 'unknown', months: null });
  });

  it('alreadyHasAlternative wins regardless of date', () => {
    expect(
      outlookTier(makeOutlook({ kind: 'alreadyHasAlternative', earliestDate: '2020-01-01' }), '2026-10-06'),
    ).toEqual({ tier: 'alreadyHasAlternative', months: null });
  });

  it('a past date is pastDate (flag for re-verification), never within12', () => {
    expect(tier('2026-10-05', '2026-10-06')).toEqual({ tier: 'pastDate', months: null });
    expect(tier('2020-01-01', '2026-10-06').tier).toBe('pastDate');
  });

  it('same day is within 12 months', () => {
    expect(tier('2026-10-06', '2026-10-06')).toEqual({ tier: 'within12', months: 0 });
  });

  it('boundaries at 12 and 36 months', () => {
    const today = '2026-10-06';
    expect(tier('2027-10-06', today)).toEqual({ tier: 'within12', months: 12 });
    expect(tier('2027-11-05', today)).toEqual({ tier: 'within12', months: 12 });
    expect(tier('2027-11-06', today)).toEqual({ tier: 'oneToThree', months: 13 });
    expect(tier('2029-10-06', today)).toEqual({ tier: 'oneToThree', months: 36 });
    expect(tier('2029-11-05', today)).toEqual({ tier: 'oneToThree', months: 36 });
    expect(tier('2029-11-06', today)).toEqual({ tier: 'none', months: 37 });
  });

  it('leap-day boundaries', () => {
    expect(tier('2028-02-29', '2027-02-28')).toEqual({ tier: 'within12', months: 12 });
    expect(tier('2029-02-28', '2028-02-29')).toEqual({ tier: 'within12', months: 12 });
    expect(tier('2031-02-28', '2028-02-29')).toEqual({ tier: 'oneToThree', months: 36 });
    expect(tier('2031-03-28', '2028-02-29')).toEqual({ tier: 'oneToThree', months: 36 });
    expect(tier('2031-03-29', '2028-02-29')).toEqual({ tier: 'none', months: 37 });
    expect(tier('2028-02-28', '2028-02-29').tier).toBe('pastDate');
  });

  it('tiers follow months exactly (property)', () => {
    const order: OutlookTier[] = ['pastDate', 'within12', 'oneToThree', 'none'];
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15000 }),
        fc.integer({ min: -400, max: 60 }),
        fc.integer({ min: 0, max: 30 }),
        (base, months, extraDays) => {
          const today = new Date(Date.UTC(2000, 0, 1) + base * 86400000).toISOString().slice(0, 10);
          const anchor = addMonths(parseISODate(today)!, months);
          const date = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day) + extraDays * 86400000)
            .toISOString()
            .slice(0, 10);
          const r = tier(date, today);
          const m = monthsBetween(today, date);
          const expected: OutlookTier =
            date < today ? 'pastDate' : m <= 12 ? 'within12' : m <= 36 ? 'oneToThree' : 'none';
          expect(r.tier).toBe(expected);
          expect(order).toContain(r.tier);
          if (r.tier !== 'pastDate') expect(r.months).toBe(m);
          expect(formatISODate(parseISODate(date)!)).toBe(date);
        },
      ),
    );
  });
});
