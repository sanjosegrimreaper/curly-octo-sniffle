/**
 * Price arithmetic. Prices are never mixed across pricing units, never guessed,
 * and rounded to cents exactly once, at the end of each computation.
 */
import type { CostPlusQuote, CostPlusSnapshot, NadacEntry, NadacFeed, Strength } from '@/data/schemas';

import { roundCents } from './money';

/** NADAC reference math for one selection: perUnit × units = total. */
export type NadacTotal = {
  /** Dollars per pricing unit, as published. */
  perUnit: number;
  /** Pricing units in the selection (quantity × unitsPerCount). */
  units: number;
  /** Exact, unrounded dollars (perUnit × units). Display `totalCents` instead. */
  totalDollars: number;
  /** The total rounded once to whole cents. */
  totalCents: number;
};

/** Days in the "monthly" figures below. */
export const DAYS_PER_MONTH = 30;

const validQuantity = (q: number) => Number.isFinite(q) && q > 0;

/**
 * NADAC total for `quantity` counts of a strength. Null when there is no entry or
 * the entry's pricing unit differs from the strength's (units are never mixed).
 */
export function nadacTotal(entry: NadacEntry | undefined, strength: Strength, quantity: number): NadacTotal | null {
  if (!entry || entry.pricingUnit !== strength.pricingUnit || !validQuantity(quantity)) return null;
  const units = quantity * strength.unitsPerCount;
  const totalDollars = entry.perUnit * units;
  return { perUnit: entry.perUnit, units, totalDollars, totalCents: roundCents(totalDollars * 100) };
}

/** The feed entry for a NADAC key (the latest `effectiveDate` when the key repeats). */
export function findNadac(feed: NadacFeed, key: string | null): NadacEntry | undefined {
  if (key === null) return undefined;
  let best: NadacEntry | undefined;
  for (const e of feed.entries) {
    if (e.key === key && (!best || e.effectiveDate > best.effectiveDate)) best = e;
  }
  return best;
}

/** The snapshot's quote for exactly this strength × quantity, or null (never interpolated). */
export function costPlusQuote(
  snapshot: CostPlusSnapshot,
  medicationId: string,
  strengthId: string,
  quantity: number,
): CostPlusQuote | null {
  return (
    snapshot.quotes.find(
      (q) => q.medicationId === medicationId && q.strengthId === strengthId && q.quantity === quantity,
    ) ?? null
  );
}

/** Quantities the snapshot has quotes for (ascending, unique). */
export function costPlusQuantities(snapshot: CostPlusSnapshot, medicationId: string, strengthId: string): number[] {
  const qs = snapshot.quotes
    .filter((q) => q.medicationId === medicationId && q.strengthId === strengthId)
    .map((q) => q.quantity);
  return [...new Set(qs)].sort((a, b) => a - b);
}

/**
 * True when the snapshot records the medicine (whole drug, `strengthId: null`) or this
 * strength as not listed on Cost Plus.
 */
export function isNotListed(snapshot: CostPlusSnapshot, medicationId: string, strengthId: string): boolean {
  return snapshot.notListed.some(
    (n) => n.medicationId === medicationId && (n.strengthId === null || n.strengthId === strengthId),
  );
}

/** Days a fill lasts, or null when the price, quantity or days-per-count is unknown. */
function daysSupply(priceCents: number | null, quantity: number, daysPerCount: number | null): number | null {
  if (priceCents === null || !Number.isFinite(priceCents) || priceCents < 0) return null;
  if (daysPerCount === null || !(daysPerCount > 0) || !validQuantity(quantity)) return null;
  return quantity * daysPerCount;
}

/** Exact (fractional) cents per day; null when unknown. Round only when displaying. */
export function perDayCents(priceCents: number | null, quantity: number, daysPerCount: number | null): number | null {
  const days = daysSupply(priceCents, quantity, daysPerCount);
  return days === null || priceCents === null ? null : priceCents / days;
}

/** Cents per 30 days, rounded once to whole cents; null when unknown. */
export function per30DaysCents(
  priceCents: number | null,
  quantity: number,
  daysPerCount: number | null,
): number | null {
  const days = daysSupply(priceCents, quantity, daysPerCount);
  return days === null || priceCents === null ? null : roundCents((priceCents * DAYS_PER_MONTH) / days);
}

/** Days a fill lasts when the person takes `unitsPerDay` counts a day; null when unknown or zero. */
function daysSupplyFromDaily(priceCents: number | null, quantity: number, unitsPerDay: number | null): number | null {
  if (priceCents === null || !Number.isFinite(priceCents) || priceCents < 0) return null;
  if (unitsPerDay === null || !Number.isFinite(unitsPerDay) || unitsPerDay <= 0 || !validQuantity(quantity)) {
    return null;
  }
  return quantity / unitsPerDay;
}

/**
 * Exact (fractional) cents per day when the person told us how many counts they take a
 * day (days = quantity / unitsPerDay). Null when the price is unknown or unitsPerDay is null/0.
 */
export function perDayCentsFromDaily(
  priceCents: number | null,
  quantity: number,
  unitsPerDay: number | null,
): number | null {
  const days = daysSupplyFromDaily(priceCents, quantity, unitsPerDay);
  return days === null || priceCents === null ? null : priceCents / days;
}

/** Cents per 30 days from a daily dose, rounded once to whole cents; null when unknown. */
export function per30DaysCentsFromDaily(
  priceCents: number | null,
  quantity: number,
  unitsPerDay: number | null,
): number | null {
  const days = daysSupplyFromDaily(priceCents, quantity, unitsPerDay);
  return days === null || priceCents === null ? null : roundCents((priceCents * DAYS_PER_MONTH) / days);
}

/** One line of the monthly budget. */
export type BudgetItem = { priceCents: number | null; quantity: number; daysPerCount: number | null };

/**
 * Monthly (30-day) total of the items whose cost per day is known, rounded once at the
 * end, plus how many items were known and unknown. Unknown items are counted, never guessed.
 */
export function budget(items: readonly BudgetItem[]): { monthlyCents: number; known: number; unknown: number } {
  let exact = 0;
  let known = 0;
  for (const it of items) {
    const perDay = perDayCents(it.priceCents, it.quantity, it.daysPerCount);
    if (perDay === null) continue;
    exact += perDay * DAYS_PER_MONTH;
    known += 1;
  }
  return { monthlyCents: roundCents(exact), known, unknown: items.length - known };
}
