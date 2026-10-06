/**
 * Pure helpers for the Income and Result screens: bracket labels in one consistent format,
 * and the income edges of a benefit rule for a household. No React, no i18n.
 */
import type { BenefitRule, FplTable, RuleCondition } from '@/data/schemas';
import { cleanFloat, displayLimit, thresholdDollars, type Bracket, type RuleResult } from '@/domain';
import type { IncomeUnit } from '@/state/screener';

/** "Under $X" / "$X to $Y" / "Over $X" (or "Any income" when the pack uses no thresholds). */
export type RangeParts =
  | { kind: 'under'; max: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'over'; min: number }
  | { kind: 'any' };

/**
 * A monthly edge in whole dollars: the exact annual limit / 12, rounded DOWN, so an
 * "Under $X a month" label never promises more room than the real limit.
 */
export function monthlyEdge(annualExact: number): number {
  return Math.floor(cleanFloat(annualExact / 12));
}

function parts(min: number | null, max: number | null): RangeParts {
  if (min === null && max === null) return { kind: 'any' };
  if (min === null && max !== null) return { kind: 'under', max };
  if (min !== null && max === null) return { kind: 'over', min };
  return { kind: 'range', min: min as number, max: max as number };
}

/**
 * Label parts for an income bracket in the chosen unit. Yearly edges are the bracket's
 * `minDollars` / `maxDollars` (already floored by the domain); monthly edges are
 * `monthlyEdge` of the exact annual edges. Adjacent brackets share the same edge number.
 */
export function bracketParts(b: Bracket, unit: IncomeUnit): RangeParts {
  if (unit === 'year') return parts(b.minDollars, b.maxDollars);
  return parts(b.minExact === null ? null : monthlyEdge(b.minExact), b.maxExact === null ? null : monthlyEdge(b.maxExact));
}

/** i18n key suffix for a range in a unit, e.g. "under_year". */
export function rangeKey(p: RangeParts, unit: IncomeUnit) {
  return `${p.kind}_${unit}` as const;
}

const isIncomeCondition = (c: RuleCondition | undefined) =>
  !!c && ('incomePctFplMax' in c || 'incomePctFplMin' in c);

/** True when a rule has any income condition (so it needs an income answer to be estimated). */
export function ruleUsesIncome(rule: BenefitRule): boolean {
  return rule.when.all.some(isIncomeCondition);
}

/**
 * The rule's income edges for a household in whole dollars (floored, via `displayLimit`):
 * the highest minimum and the lowest maximum. A 0% minimum is not an edge.
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
    min: mins.length ? displayLimit(Math.max(...mins)) : null,
    max: maxes.length ? displayLimit(Math.min(...maxes)) : null,
  };
}

/** Rule-limit parts for the result card ("Up to $X", "$X to $Y", "Over $X"); null when there is no income limit. */
export function limitParts(edges: { min: number | null; max: number | null }): RangeParts | null {
  const p = parts(edges.min, edges.max);
  return p.kind === 'any' ? null : p;
}

/**
 * "You're close to an income limit": an exact income within ±5% of a limit of a rule that
 * could still apply (no non-income condition fails).
 */
export function closeToALimit(results: readonly RuleResult[]): boolean {
  return results.some(
    (r) => r.nearLimit && r.conditions.every((c, i) => c !== 'fail' || isIncomeCondition(r.rule.when.all[i])),
  );
}
