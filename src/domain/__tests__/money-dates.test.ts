import * as fc from 'fast-check';

import {
  addMonths,
  compareDates,
  daysBetweenDates,
  daysInMonth,
  formatISODate,
  monthsBetweenDates,
  parseISODate,
} from '../dates';
import { cleanFloat, roundCents, roundDollarsToCents } from '../money';

describe('money', () => {
  it('cleanFloat removes binary noise', () => {
    expect(cleanFloat(0.1 + 0.2)).toBe(0.3);
    expect(cleanFloat(1.005 * 100)).toBe(100.5);
    expect(cleanFloat(Infinity)).toBe(Infinity);
  });

  it('roundCents rounds half away from zero after cleaning', () => {
    expect(roundCents(1.005 * 100)).toBe(101);
    expect(roundCents(83.76)).toBe(84);
    expect(roundCents(83.49)).toBe(83);
    expect(roundCents(-1.5)).toBe(-2);
    expect(Object.is(roundCents(-0.2), 0)).toBe(true);
  });

  it('roundDollarsToCents keeps 2 decimals', () => {
    expect(roundDollarsToCents(1.005)).toBe(1.01);
    expect(roundDollarsToCents(0.8376)).toBe(0.84);
    expect(roundDollarsToCents(10)).toBe(10);
  });
});

describe('dates', () => {
  it('parses only real calendar dates', () => {
    expect(parseISODate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseISODate('2027-02-29')).toBeNull();
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(parseISODate('2026-13-01')).toBeNull();
    expect(parseISODate('2026-00-10')).toBeNull();
    expect(parseISODate('2026-1-01')).toBeNull();
    expect(parseISODate('2026-01-01T00:00:00Z')).toBeNull();
    expect(parseISODate('')).toBeNull();
  });

  it('knows month lengths, leap years included', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('adds months with end-of-month clamping', () => {
    const d = (s: string) => parseISODate(s)!;
    expect(formatISODate(addMonths(d('2026-01-31'), 1))).toBe('2026-02-28');
    expect(formatISODate(addMonths(d('2028-01-31'), 1))).toBe('2028-02-29');
    expect(formatISODate(addMonths(d('2028-02-29'), 12))).toBe('2029-02-28');
    expect(formatISODate(addMonths(d('2026-11-15'), 3))).toBe('2027-02-15');
    expect(formatISODate(addMonths(d('2026-03-15'), -3))).toBe('2025-12-15');
  });

  it('compares and counts days', () => {
    const d = (s: string) => parseISODate(s)!;
    expect(compareDates(d('2026-01-01'), d('2026-01-02'))).toBe(-1);
    expect(compareDates(d('2026-01-02'), d('2026-01-02'))).toBe(0);
    expect(compareDates(d('2026-01-03'), d('2026-01-02'))).toBe(1);
    expect(daysBetweenDates(d('2028-02-28'), d('2028-03-01'))).toBe(2);
  });

  it('round-trips through formatISODate', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.UTC(1900, 0, 1)), max: new Date(Date.UTC(2200, 0, 1)), noInvalidDate: true }),
        (dt) => {
          const iso = dt.toISOString().slice(0, 10);
          expect(formatISODate(parseISODate(iso)!)).toBe(iso);
        },
      ),
    );
  });

  it('monthsBetweenDates(d, addMonths(d, n)) === n', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1990, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: -60, max: 60 }),
        (y, m, day, n) => {
          const from = { year: y, month: m, day: Math.min(day, daysInMonth(y, m)) };
          expect(monthsBetweenDates(from, addMonths(from, n))).toBe(n);
        },
      ),
    );
  });
});
