/**
 * Calendar-date helpers. Every date in the data packs is a plain `YYYY-MM-DD`
 * calendar date with no time zone, so all arithmetic here is done on UTC
 * midnights — never on local `Date` objects — which makes results identical on
 * every device regardless of its time zone or DST rules.
 */

/** A parsed calendar date. `month` is 1-12. */
export type CalendarDate = { year: number; month: number; day: number };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Parses `YYYY-MM-DD`; returns null for anything else, including impossible dates like 2026-02-30. */
export function parseISODate(iso: string): CalendarDate | null {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Number of days in a month (`month` is 1-12), leap years included. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Formats a calendar date as `YYYY-MM-DD`. */
export function formatISODate(d: CalendarDate): string {
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** UTC epoch milliseconds of the date's midnight. */
export function utcMs(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetweenDates(a: CalendarDate, b: CalendarDate): number {
  return Math.round((utcMs(b) - utcMs(a)) / MS_PER_DAY);
}

/**
 * Adds whole calendar months, clamping to the end of the month when the day does
 * not exist (Jan 31 + 1 month = Feb 28/29; Feb 29 + 12 months = Feb 28).
 */
export function addMonths(d: CalendarDate, months: number): CalendarDate {
  const total = d.year * 12 + (d.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  return { year, month, day: Math.min(d.day, daysInMonth(year, month)) };
}

/** -1, 0 or 1. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  const diff = utcMs(a) - utcMs(b);
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

/**
 * Whole calendar months from `from` to `to`, floored: the largest n such that
 * `addMonths(from, n) <= to`. Negative (and symmetric) when `to` is before `from`.
 */
export function monthsBetweenDates(from: CalendarDate, to: CalendarDate): number {
  if (compareDates(to, from) < 0) {
    const back = monthsBetweenDates(to, from);
    return back === 0 ? 0 : -back;
  }
  let n = (to.year - from.year) * 12 + (to.month - from.month);
  if (compareDates(addMonths(from, n), to) > 0) n -= 1;
  return n;
}
