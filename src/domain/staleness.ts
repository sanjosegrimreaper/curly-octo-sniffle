/**
 * Data freshness. Listings older than 6 calendar months get the sunflower banner.
 */
import { addMonths, daysBetweenDates, monthsBetweenDates, parseISODate } from './dates';

/** Default age, in calendar months, at which data counts as stale. */
export const STALE_MONTHS = 6;

/** Freshness level of a dated record. */
export type FreshnessLevel = 'fresh' | 'aging' | 'stale';

/** Whole days from `a` to `b` (b − a) on UTC calendar dates; NaN when either date is invalid. */
export function daysBetween(a: string, b: string): number {
  const da = parseISODate(a);
  const db = parseISODate(b);
  if (!da || !db) return NaN;
  return daysBetweenDates(da, db);
}

/**
 * How fresh a `verifiedAsOf` date is on `today`.
 * - level: fresh under half the stale window (3 months by default), aging until the
 *   window ends, stale from `staleMonths` calendar months on.
 * - fraction: days elapsed / days in the stale window, clamped to 0..1 (reaches 1 exactly
 *   when the record turns stale).
 * An invalid date is treated as stale (we cannot vouch for it), with `days` NaN.
 */
export function freshness(
  verifiedAsOf: string,
  today: string,
  staleMonths: number = STALE_MONTHS,
): { days: number; fraction: number; level: FreshnessLevel } {
  const from = parseISODate(verifiedAsOf);
  const to = parseISODate(today);
  if (!from || !to) return { days: NaN, fraction: 1, level: 'stale' };
  const days = daysBetweenDates(from, to);
  const months = monthsBetweenDates(from, to);
  const windowDays = daysBetweenDates(from, addMonths(from, staleMonths));
  const fraction = windowDays > 0 ? Math.min(1, Math.max(0, days / windowDays)) : 1;
  const level: FreshnessLevel = months >= staleMonths ? 'stale' : months < staleMonths / 2 ? 'fresh' : 'aging';
  return { days, fraction, level };
}

/** True when `verifiedAsOf` is at least `months` calendar months before `today` (or invalid). */
export function isStale(verifiedAsOf: string, today: string, months: number = STALE_MONTHS): boolean {
  return freshness(verifiedAsOf, today, months).level === 'stale';
}

/** Today's date as `YYYY-MM-DD` in the device's local calendar (not UTC). */
export function todayISO(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
