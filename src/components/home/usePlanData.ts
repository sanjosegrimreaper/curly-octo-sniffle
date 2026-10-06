import { useMemo } from 'react';

import { getPack } from '@/data/pack';
import type { PriceSummary } from '@/data/prices';
import { buildPlan, matchPrograms, todayISO, type PlanMedicine, type PlanStep } from '@/domain';
import { useProfile, useRuleResults } from '@/hooks/useProfile';
import { usePriceSummaries } from '@/hooks/usePrices';
import { useApplications } from '@/state/applications';
import { useMedicines, type SavedMedicine } from '@/state/medicines';
import { useScreener } from '@/state/screener';

import { summaryKey } from './planSteps';

export type PlanData = {
  steps: PlanStep[];
  saved: SavedMedicine[];
  /** Same order as `saved`; null when the medicine is no longer in the pack. */
  summaries: (PriceSummary | null)[];
  summariesByKey: ReadonlyMap<string, PriceSummary>;
  today: string;
};

/** My Plan inputs gathered from the stores, then `buildPlan` (pure, tested) decides the steps. */
export function usePlanData(): PlanData {
  const saved = useMedicines((s) => s.saved);
  const summaries = usePriceSummaries(saved);
  const profile = useProfile();
  const ruleResults = useRuleResults();
  const byProgram = useApplications((s) => s.byProgram);
  const completedAt = useScreener((s) => s.completedAt);
  const today = todayISO();

  return useMemo(() => {
    const pack = getPack();
    const summariesByKey = new Map<string, PriceSummary>();
    const planSaved: PlanMedicine[] = saved.map((m, i) => {
      const summary = summaries[i] ?? null;
      if (summary) summariesByKey.set(summaryKey(m.drugId, m.strengthId, m.quantity), summary);
      const likely = matchPrograms(pack.programs, m.drugId, profile, pack.fpl).likely.map((x) => x.program.id);
      return {
        drugId: m.drugId,
        strengthId: m.strengthId,
        quantity: m.quantity,
        bestPriceCents: summary?.lowest?.priceCents ?? null,
        seller: summary?.lowest?.seller ?? null,
        likelyProgramIds: likely,
      };
    });
    const apps = Object.values(byProgram);
    const steps = buildPlan({
      screenerDone: completedAt !== null,
      profile,
      ruleResults,
      saved: planSaved,
      trackedProgramIds: apps.map((a) => a.programId),
      renewals: apps.flatMap((a) => (a.renewBy ? [{ programId: a.programId, renewBy: a.renewBy }] : [])),
      today,
    });
    return { steps, saved, summaries, summariesByKey, today };
  }, [saved, summaries, profile, ruleResults, byProgram, completedAt, today]);
}
