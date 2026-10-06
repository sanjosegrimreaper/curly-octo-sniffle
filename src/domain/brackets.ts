/**
 * Income brackets for the Income screen, computed at runtime from the FPL table
 * and the thresholds that the pack's rules and programs actually use.
 *
 * Bracket i covers incomes in (threshold[i-1], threshold[i]]: the first bracket
 * starts at $0 and the last has no upper bound, so the brackets partition the
 * income line with no gaps or overlaps.
 */
import type { BenefitRule, FplTable, Program } from '@/data/schemas';
import type { IncomeAnswer, IncomeUnit } from '@/state/screener';

import { displayLimit, thresholdDollars } from './fpl';

/**
 * Annual income in dollars that the person could have. `max: null` = no upper bound.
 * `minExclusive` marks a range that starts just above `min` (every bracket except the
 * first), so a bracket that begins exactly at a limit is correctly "over" that limit.
 */
export type IncomeRange = { min: number; max: number | null; minExclusive?: boolean };

/** One income bracket card. */
export type Bracket = {
  index: number;
  /** % FPL at the lower edge (exclusive); null for the first bracket ($0). */
  minPct: number | null;
  /** % FPL at the upper edge (inclusive); null for the last bracket (no upper bound). */
  maxPct: number | null;
  /** Lower edge in whole dollars for labels (`displayLimit` of the exact threshold). */
  minDollars: number | null;
  /** Upper edge in whole dollars for labels (`displayLimit` of the exact threshold). */
  maxDollars: number | null;
  /** Lower edge exactly (dollars and cents), for "show the math". */
  minExact: number | null;
  /** Upper edge exactly (dollars and cents), for "show the math". */
  maxExact: number | null;
};

/** One rung of the threshold ladder for a household. */
export type Threshold = { pct: number; dollars: number };

/** Keeps finite, positive percents, de-duplicated and sorted ascending. */
export function normalizePcts(pcts: readonly number[]): number[] {
  return [...new Set(pcts.filter((p) => Number.isFinite(p) && p > 0))].sort((a, b) => a - b);
}

/**
 * The household's thresholds in ascending order (exact dollars, rounded to cents).
 * Percents that land on the same dollar amount collapse into one rung.
 * Null when the year is not in the table or the household size is invalid.
 */
export function thresholdLadder(
  table: FplTable,
  year: number,
  size: number,
  pcts: readonly number[],
): Threshold[] | null {
  const ladder: Threshold[] = [];
  for (const pct of normalizePcts(pcts)) {
    const dollars = thresholdDollars(table, year, size, pct);
    if (dollars === null) return null;
    const last = ladder[ladder.length - 1];
    if (last && last.dollars >= dollars) continue;
    ladder.push({ pct, dollars });
  }
  return ladder;
}

/**
 * Brackets for a household size and guideline year. N thresholds give N+1 brackets
 * (no thresholds → one open bracket). Returns [] when the year or size is unknown.
 */
export function buildBrackets(table: FplTable, year: number, size: number, pcts: readonly number[]): Bracket[] {
  const ladder = thresholdLadder(table, year, size, pcts);
  if (!ladder) return [];
  const brackets: Bracket[] = [];
  for (let i = 0; i <= ladder.length; i++) {
    const lo = i > 0 ? ladder[i - 1] : undefined;
    const hi = ladder[i];
    brackets.push({
      index: i,
      minPct: lo?.pct ?? null,
      maxPct: hi?.pct ?? null,
      minDollars: lo ? displayLimit(lo.dollars) : null,
      maxDollars: hi ? displayLimit(hi.dollars) : null,
      minExact: lo?.dollars ?? null,
      maxExact: hi?.dollars ?? null,
    });
  }
  return brackets;
}

/**
 * Index of the bracket containing an exact annual income (edges belong to the
 * bracket below). Null when the ladder or the income is unknown.
 */
export function bracketForIncome(
  table: FplTable,
  year: number,
  size: number,
  pcts: readonly number[],
  annualIncome: number,
): number | null {
  const ladder = thresholdLadder(table, year, size, pcts);
  if (!ladder || !Number.isFinite(annualIncome) || annualIncome < 0) return null;
  const i = ladder.findIndex((t) => annualIncome <= t.dollars);
  return i === -1 ? ladder.length : i;
}

/**
 * Every % FPL threshold that the pack's rules and programs use: each rule's
 * `incomePctFplMax` / `incomePctFplMin` and each program's published `fplMax`.
 * Sorted ascending, unique. (A 0% minimum is not a threshold and is left out.)
 */
export function thresholdsUsed(rules: readonly BenefitRule[], programs: readonly Program[]): number[] {
  const pcts: number[] = [];
  for (const rule of rules) {
    for (const cond of rule.when.all) {
      if ('incomePctFplMax' in cond) pcts.push(cond.incomePctFplMax);
      if ('incomePctFplMin' in cond) pcts.push(cond.incomePctFplMin);
    }
  }
  for (const p of programs) if (p.fplMax !== null) pcts.push(p.fplMax);
  return normalizePcts(pcts);
}

/**
 * Turns the screener's income answer into a dollar range.
 * - bracket → the exact edges of that bracket for the household size and year stored in
 *   the answer (min exclusive except for the first bracket). `pcts` must be the same
 *   threshold list the brackets were built from.
 * - exact → { min: annual, max: annual }.
 * - skip / null / an answer that no longer fits the table → null (unknown stays unknown).
 */
export function incomeRangeOf(
  answer: IncomeAnswer | null,
  table: FplTable,
  pcts: readonly number[],
): IncomeRange | null {
  if (!answer) return null;
  switch (answer.kind) {
    case 'skip':
      return null;
    case 'exact':
      if (!Number.isFinite(answer.annual) || answer.annual < 0) return null;
      return { min: answer.annual, max: answer.annual };
    case 'bracket': {
      const ladder = thresholdLadder(table, answer.fplYear, answer.householdSize, pcts);
      if (!ladder || !Number.isInteger(answer.index) || answer.index < 0 || answer.index > ladder.length) {
        return null;
      }
      const lo = answer.index > 0 ? ladder[answer.index - 1] : undefined;
      const hi = ladder[answer.index];
      return lo
        ? { min: lo.dollars, max: hi?.dollars ?? null, minExclusive: true }
        : { min: 0, max: hi?.dollars ?? null };
    }
  }
}

/** Converts an amount typed per month or per year to an annual amount (no rounding). */
export function toAnnual(amount: number, unit: IncomeUnit): number {
  return unit === 'month' ? amount * 12 : amount;
}

/** Converts an annual amount to the given unit (no rounding), for the muted "other unit" line. */
export function fromAnnual(annual: number, unit: IncomeUnit): number {
  return unit === 'month' ? annual / 12 : annual;
}
