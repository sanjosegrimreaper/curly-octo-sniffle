/**
 * Generic-competition outlook tiers. A date is "the earliest relevant verified
 * expiry", never a promised launch date.
 */
import type { Outlook } from '@/data/schemas';

import { compareDates, monthsBetweenDates, parseISODate } from './dates';

/** Outlook tier for the tangerine card. */
export type OutlookTier = 'within12' | 'oneToThree' | 'none' | 'alreadyHasAlternative' | 'pastDate' | 'unknown';

/**
 * Whole calendar months from one `YYYY-MM-DD` date to another, floored and computed
 * on UTC calendar dates (Jan 31 → Feb 28 counts as 1 month; month ends clamp).
 * Negative when `toISO` is earlier. NaN when either date is invalid.
 */
export function monthsBetween(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  if (!from || !to) return NaN;
  return monthsBetweenDates(from, to);
}

/**
 * Tier for a medicine's outlook record as of `today` (YYYY-MM-DD):
 * alreadyHasAlternative → itself; no or invalid date → unknown; date before today →
 * pastDate (flag for re-verification; never show "within 12 months"); otherwise by
 * whole months until the date: ≤ 12 → within12, ≤ 36 → oneToThree, else none.
 */
export function outlookTier(o: Outlook | undefined, today: string): { tier: OutlookTier; months: number | null } {
  if (!o) return { tier: 'unknown', months: null };
  if (o.kind === 'alreadyHasAlternative') return { tier: 'alreadyHasAlternative', months: null };
  if (o.earliestDate === null) return { tier: 'unknown', months: null };
  const date = parseISODate(o.earliestDate);
  const now = parseISODate(today);
  if (!date || !now) return { tier: 'unknown', months: null };
  if (compareDates(date, now) < 0) return { tier: 'pastDate', months: null };
  const months = monthsBetweenDates(now, date);
  if (months <= 12) return { tier: 'within12', months };
  if (months <= 36) return { tier: 'oneToThree', months };
  return { tier: 'none', months };
}
