import * as fc from 'fast-check';

import { daysBetween, freshness, isStale, STALE_MONTHS, todayISO } from '../staleness';

describe('daysBetween', () => {
  it('counts whole calendar days (b − a)', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
    expect(daysBetween('2026-10-06', '2026-10-06')).toBe(0);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('is not affected by DST changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('is NaN for invalid dates', () => {
    expect(daysBetween('2026-02-30', '2026-03-01')).toBeNaN();
    expect(daysBetween('2026-01-01', '')).toBeNaN();
  });
});

describe('freshness', () => {
  const v = '2026-01-15';

  it('fresh under 3 calendar months', () => {
    expect(freshness(v, v)).toEqual({ days: 0, fraction: 0, level: 'fresh' });
    expect(freshness(v, '2026-04-14').level).toBe('fresh');
  });

  it('aging from 3 months until 6', () => {
    expect(freshness(v, '2026-04-15').level).toBe('aging');
    expect(freshness(v, '2026-07-14').level).toBe('aging');
  });

  it('stale from 6 months on, with fraction exactly 1', () => {
    const f = freshness(v, '2026-07-15');
    expect(f).toEqual({ days: 181, fraction: 1, level: 'stale' });
    expect(freshness(v, '2030-01-01').fraction).toBe(1);
  });

  it('fraction is days / days in the 6-month window', () => {
    expect(freshness(v, '2026-04-15').fraction).toBeCloseTo(90 / 181, 10);
    expect(freshness(v, '2026-07-14').fraction).toBeLessThan(1);
  });

  it('handles month-end and leap-day windows', () => {
    expect(freshness('2027-08-31', '2028-02-28').level).toBe('aging');
    expect(freshness('2027-08-31', '2028-02-29').level).toBe('stale');
    expect(freshness('2028-02-29', '2028-08-28').level).toBe('aging');
    expect(freshness('2028-02-29', '2028-08-29').level).toBe('stale');
  });

  it('a date in the future (clock skew) is fresh with fraction 0', () => {
    expect(freshness('2026-10-07', '2026-10-06')).toEqual({ days: -1, fraction: 0, level: 'fresh' });
  });

  it('an invalid date is treated as stale', () => {
    const f = freshness('2026-02-30', '2026-10-06');
    expect(f.level).toBe('stale');
    expect(f.days).toBeNaN();
  });

  it('accepts a custom window', () => {
    expect(freshness(v, '2026-07-15', 12).level).toBe('aging');
    expect(freshness(v, '2026-07-14', 12).level).toBe('fresh');
    expect(freshness(v, '2027-01-15', 12).level).toBe('stale');
  });

  it('fraction is within 0..1 and monotonic; level agrees with isStale (property)', () => {
    const day = fc
      .integer({ min: 0, max: 20000 })
      .map((n) => new Date(Date.UTC(2000, 0, 1) + n * 86400000).toISOString().slice(0, 10));
    fc.assert(
      fc.property(day, fc.integer({ min: 0, max: 800 }), fc.integer({ min: 0, max: 800 }), (from, d1, d2) => {
        const plus = (n: number) => new Date(Date.parse(`${from}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
        const [a, b] = d1 <= d2 ? [d1, d2] : [d2, d1];
        const fa = freshness(from, plus(a));
        const fb = freshness(from, plus(b));
        expect(fa.days).toBe(a);
        expect(fa.fraction).toBeGreaterThanOrEqual(0);
        expect(fb.fraction).toBeLessThanOrEqual(1);
        expect(fa.fraction).toBeLessThanOrEqual(fb.fraction);
        expect(fa.level === 'stale').toBe(isStale(from, plus(a)));
        expect(fa.fraction === 1).toBe(fa.level === 'stale');
      }),
    );
  });
});

describe('isStale', () => {
  it('flips at exactly 6 calendar months', () => {
    expect(STALE_MONTHS).toBe(6);
    expect(isStale('2026-01-15', '2026-07-14')).toBe(false);
    expect(isStale('2026-01-15', '2026-07-15')).toBe(true);
    expect(isStale('2026-01-15', '2026-04-15', 3)).toBe(true);
    expect(isStale('not-a-date', '2026-04-15')).toBe(true);
  });
});

describe('todayISO', () => {
  it('formats the local calendar date', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59, 59))).toBe('2026-01-05');
    expect(todayISO(new Date(2026, 11, 31, 0, 0, 1))).toBe('2026-12-31');
    expect(todayISO(new Date(999, 2, 4, 12))).toBe('0999-03-04');
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses local components, not UTC (property over instants)', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.UTC(1990, 0, 1)), max: new Date(Date.UTC(2100, 0, 1)), noInvalidDate: true }),
        (d) => {
          const [y, m, day] = todayISO(d).split('-').map(Number);
          expect([y, m, day]).toEqual([d.getFullYear(), d.getMonth() + 1, d.getDate()]);
        },
      ),
    );
  });
});
