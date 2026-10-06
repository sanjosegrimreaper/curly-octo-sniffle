/**
 * Pure helpers for the Income and Result screens: bracket labels in one consistent format,
 * the income edges of a benefit rule for a household, and "close to / a little over a limit".
 * No React, no i18n.
 */
import type { BenefitRule, FplTable, RuleCondition } from '@/data/schemas';
import {
  cleanFloat,
  displayLimit,
  NEAR_LIMIT_FRACTION,
  thresholdDollars,
  type Bracket,
  type RuleResult,
} from '@/domain';
import type { IncomeUnit } from '@/state/screener';

/**
 * A whole-dollar income range for labels:
 * - under: "$X or less"          (the first bracket; limits are inclusive)
 * - range: "$X to $Y"            (X is the lower edge + $1, because the edge belongs to the bracket below)
 * - over:  "More than $X"        (the last bracket)
 * - any:   no thresholds at all
 */
export type RangeParts =
  | { kind: 'under'; max: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'over'; min: number }
  | { kind: 'any' };

/**
 * A monthly edge in whole dollars: the exact annual limit / 12, rounded DOWN, so a
 * "$X or less a month" label never promises more room than the real limit.
 */
export function monthlyEdge(annualExact: number): number {
  return Math.floor(cleanFloat(annualExact / 12));
}

/**
 * Label parts for an income bracket in the chosen unit. Bracket i covers (lower edge, upper edge],
 * so in whole dollars it starts at lower edge + 1. Yearly edges are the bracket's `minDollars` /
 * `maxDollars` (already floored by the domain); monthly edges are `monthlyEdge` of the exact edges.
 */
export function bracketParts(b: Bracket, unit: IncomeUnit): RangeParts {
  const lo = unit === 'year' ? b.minDollars : b.minExact === null ? null : monthlyEdge(b.minExact);
  const hi = unit === 'year' ? b.maxDollars : b.maxExact === null ? null : monthlyEdge(b.maxExact);
  if (lo === null && hi === null) return { kind: 'any' };
  if (lo === null && hi !== null) return { kind: 'under', max: hi };
  if (lo !== null && hi === null) return { kind: 'over', min: lo };
  return { kind: 'range', min: (lo as number) + 1, max: hi as number };
}

/** i18n key suffix for a range in a unit, e.g. "under_year". */
export function rangeKey(p: RangeParts, unit: IncomeUnit) {
  return `${p.kind}_${unit}` as const;
}

const isIncomeCondition = (c: RuleCondition | undefined) => !!c && ('incomePctFplMax' in c || 'incomePctFplMin' in c);

/** True when a rule has any income condition (so it needs an income answer to be estimated). */
export function ruleUsesIncome(rule: BenefitRule): boolean {
  return rule.when.all.some(isIncomeCondition);
}

/**
 * The rule's income limits for a household in whole dollars: the lowest maximum, floored
 * ("up to $X" never promises more), and the highest minimum, rounded up (the first whole
 * dollar that meets it). A 0% minimum is not a limit.
 */
export function ruleIncomeEdges(
  rule: BenefitRule,
  table: FplTable,
  year: number,
  size: number | null,
): { min: number | null; max: number | null } {
  if (size === null) return { min: null, max: null };
  const mins: number[] = [];
  const maxes: number[] = [];
  for (const c of rule.when.all) {
    if ('incomePctFplMin' in c && c.incomePctFplMin > 0) {
      const d = thresholdDollars(table, year, size, c.incomePctFplMin);
      if (d !== null) mins.push(d);
    } else if ('incomePctFplMax' in c) {
      const d = thresholdDollars(table, year, size, c.incomePctFplMax);
      if (d !== null) maxes.push(d);
    }
  }
  return {
    min: mins.length ? Math.ceil(cleanFloat(Math.max(...mins))) : null,
    max: maxes.length ? displayLimit(Math.min(...maxes)) : null,
  };
}

/** Rule-limit parts for the result card ("Up to $X", "$X to $Y", "$X or more"); null when there is no income limit. */
export function limitParts(edges: { min: number | null; max: number | null }): RangeParts | null {
  const { min, max } = edges;
  if (min === null && max === null) return null;
  if (min === null && max !== null) return { kind: 'under', max };
  if (min !== null && max === null) return { kind: 'over', min };
  return { kind: 'range', min: min as number, max: max as number };
}

/**
 * A rule the person misses only because their exact income is a little (≤ 5%) over one of its
 * income maximums — every other condition passes or is unknown. "Some income may not count."
 */
export function isJustOverLimit(r: RuleResult, table: FplTable, size: number | null, annual: number | null): boolean {
  if (r.tier !== 'notLikely' || size === null || annual === null) return false;
  let overAny = false;
  for (let i = 0; i < r.rule.when.all.length; i++) {
    if (r.conditions[i] !== 'fail') continue;
    const c = r.rule.when.all[i];
    if (!c || !('incomePctFplMax' in c)) return false;
    const limit = thresholdDollars(table, r.fplYear, size, c.incomePctFplMax);
    if (limit === null) return false;
    if (!(annual > limit && annual <= cleanFloat(limit * (1 + NEAR_LIMIT_FRACTION)))) return false;
    overAny = true;
  }
  return overAny;
}

/**
 * For an exact income: `close` = within 5% of a limit of a rule that could still apply;
 * `over` = a little over the maximum of a rule that would otherwise apply.
 */
export function incomeProximity(
  results: readonly RuleResult[],
  table: FplTable,
  size: number | null,
  annual: number | null,
): { close: boolean; over: boolean } {
  return {
    close: results.some((r) => r.tier !== 'notLikely' && r.nearLimit),
    over: results.some((r) => isJustOverLimit(r, table, size, annual)),
  };
}
