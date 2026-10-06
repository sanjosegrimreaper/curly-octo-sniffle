import { useMemo } from 'react';

import { getPack } from '@/data/pack';
import { evaluateRules, matchPrograms, profileFromScreener, thresholdsUsed, type Profile, type RuleResult } from '@/domain';
import { useScreener } from '@/state/screener';

/** Income thresholds (% FPL) used by any rule or program in the pack — drives the income brackets. */
export function usePcts(): number[] {
  return useMemo(() => {
    const pack = getPack();
    return thresholdsUsed(pack.benefits.rules, pack.programs);
  }, []);
}

/** The person's answers, normalized for the eligibility engine. */
export function useProfile(): Profile {
  const screener = useScreener();
  const pcts = usePcts();
  return useMemo(() => profileFromScreener(screener, getPack().fpl, pcts), [screener, pcts]);
}

/** Coverage results (Medi-Cal, Covered California, ...) for the current answers, best first. */
export function useRuleResults(): RuleResult[] {
  const profile = useProfile();
  return useMemo(() => {
    const pack = getPack();
    return evaluateRules(pack.benefits.rules, profile, pack.fpl);
  }, [profile]);
}

/** Assistance programs for one medicine, grouped likely / worth checking / closed. */
export function useProgramMatches(medicationId: string) {
  const profile = useProfile();
  return useMemo(() => {
    const pack = getPack();
    return matchPrograms(pack.programs, medicationId, profile, pack.fpl);
  }, [profile, medicationId]);
}
