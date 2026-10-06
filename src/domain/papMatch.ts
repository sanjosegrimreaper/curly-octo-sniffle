/**
 * Patient-assistance program matching for one medicine. A program is "likely"
 * only when all three hold: the person's whole income range is under the
 * published cap, the insurance rule fits, and the program enrolls new patients.
 */
import type { FplTable, InsuranceStatus, Program } from '@/data/schemas';

import { compareIncome, type Profile } from './eligibility';
import { thresholdDollars, yearOrLatest } from './fpl';

/** Does the person's insurance fit a program's rule? */
export type Fit = 'yes' | 'maybe' | 'no';

/** Income versus a program cap. `unpublished` = the program publishes no cap. */
export type IncomeFit = 'under' | 'over' | 'overlap' | 'unknown' | 'unpublished';

/** One program, matched against the profile. */
export type ProgramMatch = {
  program: Program;
  /** The cap in dollars for this household (exact; format with `displayLimit`), or null. */
  capDollars: number | null;
  insurance: Fit;
  income: IncomeFit;
  group: 'likely' | 'worthChecking' | 'closed';
};

/** Grouped matches, each group in display order. */
export type ProgramMatches = { likely: ProgramMatch[]; worthChecking: ProgramMatch[]; closed: ProgramMatch[] };

const FIT: Record<Program['insuranceRule'], Record<InsuranceStatus, Fit>> = {
  uninsuredOnly: { none: 'yes', unsure: 'maybe', private: 'no', 'medi-cal': 'no', medicare: 'no', other: 'no' },
  uninsuredOrUnderinsured: {
    none: 'yes',
    unsure: 'maybe',
    private: 'maybe',
    'medi-cal': 'no',
    medicare: 'maybe',
    other: 'maybe',
  },
  medicareOk: { none: 'yes', unsure: 'maybe', private: 'maybe', 'medi-cal': 'no', medicare: 'yes', other: 'maybe' },
  commercialOnly: { none: 'no', unsure: 'maybe', private: 'yes', 'medi-cal': 'no', medicare: 'no', other: 'maybe' },
  any: { none: 'yes', unsure: 'yes', private: 'yes', 'medi-cal': 'yes', medicare: 'yes', other: 'yes' },
  unknown: { none: 'maybe', unsure: 'maybe', private: 'maybe', 'medi-cal': 'maybe', medicare: 'maybe', other: 'maybe' },
};

/** How well an insurance status fits a program's insurance rule. */
export function insuranceFit(rule: Program['insuranceRule'], status: InsuranceStatus): Fit {
  return FIT[rule][status];
}

const INSURANCE_RANK: Record<Fit, number> = { yes: 0, maybe: 1, no: 2 };
const INCOME_RANK: Record<IncomeFit, number> = { under: 0, overlap: 1, unknown: 2, unpublished: 2, over: 3 };

/** Matches one program against a profile (no medication filter). */
export function matchProgram(program: Program, profile: Profile, table: FplTable): ProgramMatch {
  const insurance = insuranceFit(program.insuranceRule, profile.insurance);
  let capDollars: number | null = null;
  let income: IncomeFit;
  if (program.fplMax === null) {
    income = 'unpublished';
  } else {
    if (profile.householdSize !== null) {
      capDollars = thresholdDollars(table, yearOrLatest(table, program.fplYear), profile.householdSize, program.fplMax);
    }
    if (capDollars === null || profile.income === null) {
      income = 'unknown';
    } else {
      const c = compareIncome(profile.income, capDollars, 'max');
      income = c === 'pass' ? 'under' : c === 'fail' ? 'over' : 'overlap';
    }
  }
  const group = program.closedToNew ? 'closed' : income === 'under' && insurance === 'yes' ? 'likely' : 'worthChecking';
  return { program, capDollars, insurance, income, group };
}

/**
 * Matches every program that covers `medicationId` and groups them: likely, worth
 * checking (best first: insurance yes > maybe > no, then income under > overlap >
 * unknown/unpublished > over), and closed to new patients (always shown last).
 */
export function matchPrograms(
  programs: readonly Program[],
  medicationId: string,
  profile: Profile,
  table: FplTable,
): ProgramMatches {
  const out: ProgramMatches = { likely: [], worthChecking: [], closed: [] };
  for (const p of programs) {
    if (!p.medicationIds.includes(medicationId)) continue;
    const m = matchProgram(p, profile, table);
    out[m.group].push(m);
  }
  out.worthChecking.sort(
    (a, b) =>
      INSURANCE_RANK[a.insurance] - INSURANCE_RANK[b.insurance] || INCOME_RANK[a.income] - INCOME_RANK[b.income],
  );
  return out;
}
