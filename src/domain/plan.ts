/**
 * My Plan: the few next steps that matter most, in priority order.
 */
import type { BenefitRule } from '@/data/schemas';

import { daysBetween } from './staleness';
import type { Profile, RuleResult } from './eligibility';

/** One step on My Plan. */
export type PlanStep =
  | { kind: 'finishScreener' }
  | { kind: 'applyBenefit'; ruleId: string; programKey: BenefitRule['programKey'] }
  | { kind: 'checkMedicare' }
  | { kind: 'findMedicine' }
  | { kind: 'buyNow'; drugId: string; strengthId: string; quantity: number; priceCents: number; seller: string }
  | { kind: 'callProgram'; programId: string; drugId: string }
  | { kind: 'renew'; programId: string; renewBy: string }
  | { kind: 'trackApplication'; programId: string };

/** A saved medicine as My Plan sees it. */
export type PlanMedicine = {
  drugId: string;
  strengthId: string;
  quantity: number;
  bestPriceCents: number | null;
  seller: string | null;
  /** Programs that matched as "likely" for this medicine. */
  likelyProgramIds: string[];
};

/** Everything `buildPlan` needs. */
export type PlanInput = {
  screenerDone: boolean;
  profile: Profile;
  ruleResults: RuleResult[];
  saved: PlanMedicine[];
  trackedProgramIds: string[];
  renewals: { programId: string; renewBy: string }[];
  /** YYYY-MM-DD */
  today: string;
};

/** Most steps shown at once. */
export const MAX_PLAN_STEPS = 5;
/** A renewal shows up this many days before its date (and stays while overdue). */
export const RENEW_WINDOW_DAYS = 45;

const COVERAGE_KEYS: readonly BenefitRule['programKey'][] = ['medi-cal', 'covered-california'];

function stepKey(s: PlanStep): string {
  switch (s.kind) {
    case 'finishScreener':
    case 'checkMedicare':
    case 'findMedicine':
      return s.kind;
    case 'applyBenefit':
      return `${s.kind}:${s.ruleId}`;
    case 'buyNow':
      return `${s.kind}:${s.drugId}:${s.strengthId}:${s.quantity}`;
    case 'callProgram':
    case 'renew':
    case 'trackApplication':
      return `${s.kind}:${s.programId}`;
  }
}

/**
 * Builds My Plan, in priority order: finish the screener → apply for Medi-Cal /
 * Covered California (first mayQualify rule, uninsured or unsure only) → check
 * Medicare (65+, uninsured or unsure) → renew (due within 45 days or overdue, soonest
 * first) → call likely programs not yet tracked → buy saved medicines that have a
 * price → find a medicine (nothing saved) → keep tracked applications moving.
 * At most 5 steps, no duplicates.
 */
export function buildPlan(input: PlanInput): PlanStep[] {
  const steps: PlanStep[] = [];
  const seen = new Set<string>();
  const add = (s: PlanStep) => {
    const k = stepKey(s);
    if (!seen.has(k)) {
      seen.add(k);
      steps.push(s);
    }
  };
  const uninsured = input.profile.insurance === 'none' || input.profile.insurance === 'unsure';

  if (!input.screenerDone) add({ kind: 'finishScreener' });

  if (uninsured) {
    const r = input.ruleResults.find((x) => x.tier === 'mayQualify' && COVERAGE_KEYS.includes(x.rule.programKey));
    if (r) add({ kind: 'applyBenefit', ruleId: r.rule.id, programKey: r.rule.programKey });
  }

  if (uninsured && input.profile.age65 === 'yes') add({ kind: 'checkMedicare' });

  const renewals = input.renewals
    .map((r) => ({ ...r, days: daysBetween(input.today, r.renewBy) }))
    .filter((r) => Number.isFinite(r.days) && r.days <= RENEW_WINDOW_DAYS)
    .sort((a, b) => a.days - b.days);
  for (const r of renewals) add({ kind: 'renew', programId: r.programId, renewBy: r.renewBy });

  const tracked = new Set(input.trackedProgramIds);
  const called = new Set<string>();
  for (const med of input.saved) {
    for (const programId of med.likelyProgramIds) {
      if (tracked.has(programId) || called.has(programId)) continue;
      called.add(programId);
      add({ kind: 'callProgram', programId, drugId: med.drugId });
    }
  }

  for (const med of input.saved) {
    if (med.bestPriceCents === null || med.seller === null) continue;
    add({
      kind: 'buyNow',
      drugId: med.drugId,
      strengthId: med.strengthId,
      quantity: med.quantity,
      priceCents: med.bestPriceCents,
      seller: med.seller,
    });
  }

  if (input.saved.length === 0) add({ kind: 'findMedicine' });

  const renewing = new Set(renewals.map((r) => r.programId));
  for (const programId of input.trackedProgramIds) {
    if (!renewing.has(programId)) add({ kind: 'trackApplication', programId });
  }

  return steps.slice(0, MAX_PLAN_STEPS);
}
