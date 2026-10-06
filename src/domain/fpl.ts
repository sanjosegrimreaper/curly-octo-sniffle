/**
 * Federal Poverty Level math. Every number comes from the pack's `fpl.json`;
 * nothing here knows a real guideline value.
 */
import type { FplTable, FplYear } from '@/data/schemas';

import { cleanFloat, roundDollarsToCents } from './money';

/** Published tables list household sizes 1..8; larger households add `perAdditional` per person. */
const LISTED_SIZES = 8;

/** The table row for a guideline year, or undefined when the pack does not carry that year. */
export function fplYearRow(table: FplTable, year: number): FplYear | undefined {
  return table.years.find((y) => y.year === year);
}

/**
 * Annual poverty guideline in dollars for a household size (whole people, >= 1).
 * Sizes above 8 are derived from the published per-additional-person amount.
 * Returns null when the year is not in the table or the size is not a positive integer.
 */
export function guidelineFor(table: FplTable, year: number, size: number): number | null {
  if (!Number.isInteger(size) || size < 1) return null;
  const row = fplYearRow(table, year);
  if (!row) return null;
  if (size <= LISTED_SIZES) return row.bySize[size - 1] ?? null;
  const top = row.bySize[LISTED_SIZES - 1];
  if (top === undefined) return null;
  return top + row.perAdditional * (size - LISTED_SIZES);
}

/** The newest guideline year in the table (tables always hold at least one year). */
export function latestYear(table: FplTable): number {
  return table.years.reduce((max, y) => (y.year > max ? y.year : max), -Infinity);
}

/** `preferred` when the table carries that year, otherwise the latest year in the table. */
export function yearOrLatest(table: FplTable, preferred: number | null): number {
  if (preferred !== null && fplYearRow(table, preferred)) return preferred;
  return latestYear(table);
}

/**
 * Income limit in dollars for `pct`% of the guideline: guideline × pct / 100,
 * rounded once to cents. Null when the guideline is unknown.
 */
export function thresholdDollars(table: FplTable, year: number, size: number, pct: number): number | null {
  const g = guidelineFor(table, year, size);
  if (g === null || !Number.isFinite(pct) || pct < 0) return null;
  return roundDollarsToCents((g * pct) / 100);
}

/**
 * Whole dollars for an "up to $X" label. Always floors, so the label never
 * promises more than the real limit (e.g. $20,783.50 shows as $20,783).
 */
export function displayLimit(dollars: number): number {
  return Math.floor(cleanFloat(dollars));
}

/**
 * Annual income as a percent of the poverty guideline (unrounded).
 * Null when the guideline is unknown or the income is not a finite, non-negative number.
 */
export function pctOfFpl(table: FplTable, year: number, size: number, annualIncome: number): number | null {
  const g = guidelineFor(table, year, size);
  if (g === null || !Number.isFinite(annualIncome) || annualIncome < 0) return null;
  return (annualIncome / g) * 100;
}
