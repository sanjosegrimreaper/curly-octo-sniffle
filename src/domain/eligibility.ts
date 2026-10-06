/**
 * Benefit-rule evaluation. Outputs are tiers (`mayQualify` / `worthChecking` /
 * `notLikely`), never a yes/no "eligible". Anything we do not know stays unknown
 * and can only lower confidence, never raise it.
 */
import type { BenefitRule, FplTable, InsuranceStatus, RuleCondition } from '@/data/schemas';
import type { ScreenerValues } from '@/state/screener';

import { incomeRangeOf, type IncomeRange } from './brackets';
import { thresholdDollars, yearOrLatest } from './fpl';
import { cleanFloat } from './money';

/** What the screener knows about the person. Every field may be unknown. */
export type Profile = {
  insurance: InsuranceStatus;
  age65: 'yes' | 'no' | 'skip' | null;
  /** Region county id (e.g. 'santa-clara'), 'other', or null when not answered. */
  county: string | null;
  householdSize: number | null;
  income: IncomeRange | null;
};

/** Outcome of one condition. `partial` = the income range straddles the limit. */
export type ConditionResult = 'pass' | 'partial' | 'unknown' | 'fail';

/** A rule's tier. Never a boolean. */
export type RuleTier = 'mayQualify' | 'worthChecking' | 'notLikely';

/** The evaluation of one benefit rule for a profile. */
export type RuleResult = {
  rule: BenefitRule;
  tier: RuleTier;
  /** Exact income within ±5% of one of the rule's income limits ("You're close to the limit"). */
  nearLimit: boolean;
  /** The rule's (lowest) `incomePctFplMax` limit for this household, exact; format with `displayLimit`. */
  limitDollars: number | null;
  /** The guideline year actually used (the rule's year, or the latest one in the table). */
  fplYear: number;
  /** One result per condition in `rule.when.all`, in order. */
  conditions: ConditionResult[];
};

/** Share of a limit that counts as "close to the limit". */
export const NEAR_LIMIT_FRACTION = 0.05;

const TIER_ORDER: Record<RuleTier, number> = { mayQualify: 0, worthChecking: 1, notLikely: 2 };

/**
 * Maps the coverage answers to an insurance status. Mirrors `insuranceStatusOf` in
 * src/state/screener.ts, re-implemented here so the domain layer stays free of
 * store (and React) imports.
 */
export function insuranceFromAnswers(s: Pick<ScreenerValues, 'coverage' | 'coverageType'>): InsuranceStatus {
  if (s.coverage === 'no') return 'none';
  if (s.coverage === 'unsure' || s.coverage === null) return 'unsure';
  switch (s.coverageType) {
    case 'medi-cal':
      return 'medi-cal';
    case 'medicare':
      return 'medicare';
    case 'private':
      return 'private';
    default:
      return 'other';
  }
}

const validSize = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1;

/**
 * Builds the evaluation profile from screener answers. `pcts` must be the threshold
 * list the income brackets were built from (see `thresholdsUsed`).
 */
export function profileFromScreener(s: ScreenerValues, table: FplTable, pcts: readonly number[]): Profile {
  const bracketSize = s.income?.kind === 'bracket' ? s.income.householdSize : null;
  return {
    insurance: insuranceFromAnswers(s),
    age65: s.age65,
    county: s.county ?? null,
    householdSize: validSize(s.householdSize) ? s.householdSize : validSize(bracketSize) ? bracketSize : null,
    income: incomeRangeOf(s.income, table, pcts),
  };
}

/** Every income in the range is at or below the limit. */
function allAtOrBelow(r: IncomeRange, limit: number): boolean {
  return r.max !== null && cleanFloat(r.max) <= cleanFloat(limit);
}
/** Every income in the range is strictly above the limit. */
function allAbove(r: IncomeRange, limit: number): boolean {
  const min = cleanFloat(r.min);
  const l = cleanFloat(limit);
  return min > l || (min === l && r.minExclusive === true);
}
/** Every income in the range is at or above the limit. */
function allAtOrAbove(r: IncomeRange, limit: number): boolean {
  return cleanFloat(r.min) >= cleanFloat(limit);
}
/** Every income in the range is strictly below the limit. */
function allBelow(r: IncomeRange, limit: number): boolean {
  return r.max !== null && cleanFloat(r.max) < cleanFloat(limit);
}

/**
 * Compares an income range with a limit.
 * - `max`: pass when the whole range is at or below the limit, fail when it is wholly above.
 * - `min`: pass when the whole range is at or above the limit, fail when it is wholly below.
 * Anything else straddles the limit → partial.
 */
export function compareIncome(range: IncomeRange, limit: number, kind: 'max' | 'min'): 'pass' | 'partial' | 'fail' {
  if (kind === 'max') return allAtOrBelow(range, limit) ? 'pass' : allAbove(range, limit) ? 'fail' : 'partial';
  return allAtOrAbove(range, limit) ? 'pass' : allBelow(range, limit) ? 'fail' : 'partial';
}

/**
 * Evaluates one rule condition for a profile, using guideline year `fplYear`.
 * Insurance and county are list membership; age65 must match. Unknown household
 * size, income, age, county or guideline year → 'unknown'.
 */
export function evaluateCondition(
  cond: RuleCondition,
  profile: Profile,
  table: FplTable,
  fplYear: number,
): ConditionResult {
  if ('insurance' in cond) return cond.insurance.includes(profile.insurance) ? 'pass' : 'fail';
  if ('age65' in cond) {
    if (profile.age65 === null || profile.age65 === 'skip') return 'unknown';
    return profile.age65 === cond.age65 ? 'pass' : 'fail';
  }
  if ('county' in cond) {
    if (profile.county === null) return 'unknown';
    return cond.county.includes(profile.county) ? 'pass' : 'fail';
  }
  const kind = 'incomePctFplMax' in cond ? 'max' : 'min';
  const pct = 'incomePctFplMax' in cond ? cond.incomePctFplMax : cond.incomePctFplMin;
  if (!profile.income || !validSize(profile.householdSize)) return 'unknown';
  const limit = thresholdDollars(table, fplYear, profile.householdSize, pct);
  if (limit === null) return 'unknown';
  return compareIncome(profile.income, limit, kind);
}

/** Income limits (dollars) of a rule for the profile's household; empty when the household is unknown. */
function incomeLimits(rule: BenefitRule, profile: Profile, table: FplTable, fplYear: number) {
  const max: number[] = [];
  const min: number[] = [];
  if (!validSize(profile.householdSize)) return { max, min };
  for (const cond of rule.when.all) {
    if ('incomePctFplMax' in cond) {
      const d = thresholdDollars(table, fplYear, profile.householdSize, cond.incomePctFplMax);
      if (d !== null) max.push(d);
    } else if ('incomePctFplMin' in cond) {
      const d = thresholdDollars(table, fplYear, profile.householdSize, cond.incomePctFplMin);
      if (d !== null) min.push(d);
    }
  }
  return { max, min };
}

/**
 * Evaluates a rule: any failed condition → notLikely; every condition passes → the
 * rule's own tier; otherwise (partial or unknown) → worthChecking.
 */
export function evaluateRule(rule: BenefitRule, profile: Profile, table: FplTable): RuleResult {
  const fplYear = yearOrLatest(table, rule.fplYear);
  const conditions = rule.when.all.map((c) => evaluateCondition(c, profile, table, fplYear));
  const tier: RuleTier = conditions.includes('fail')
    ? 'notLikely'
    : conditions.every((c) => c === 'pass')
      ? rule.tier
      : 'worthChecking';
  const limits = incomeLimits(rule, profile, table, fplYear);
  const income = profile.income;
  const exact = income !== null && income.max !== null && income.min === income.max ? income.min : null;
  const nearLimit =
    exact !== null &&
    [...limits.max, ...limits.min].some((l) => Math.abs(exact - l) <= cleanFloat(l * NEAR_LIMIT_FRACTION));
  return {
    rule,
    tier,
    nearLimit,
    limitDollars: limits.max.length > 0 ? Math.min(...limits.max) : null,
    fplYear,
    conditions,
  };
}

/** Sorts results mayQualify → worthChecking → notLikely, keeping pack order within a tier. */
export function sortRuleResults(results: readonly RuleResult[]): RuleResult[] {
  return [...results].sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/** Evaluates every rule and sorts the results (see `sortRuleResults`). */
export function evaluateRules(rules: readonly BenefitRule[], profile: Profile, table: FplTable): RuleResult[] {
  return sortRuleResults(rules.map((r) => evaluateRule(r, profile, table)));
}
