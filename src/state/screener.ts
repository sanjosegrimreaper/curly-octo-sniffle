import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { sessionStorage, STORAGE_KEYS } from './storage';

export type CoverageAnswer = 'yes' | 'no' | 'unsure';
export type CoverageType = 'private' | 'medi-cal' | 'medicare' | 'other';
export type IncomeUnit = 'year' | 'month';

export type IncomeAnswer =
  | { kind: 'bracket'; index: number; householdSize: number; fplYear: number }
  | { kind: 'exact'; annual: number }
  | { kind: 'skip' };

export type ScreenerState = {
  coverage: CoverageAnswer | null;
  coverageType: CoverageType | null;
  age65: 'yes' | 'no' | 'skip' | null;
  /** Region county id ('santa-clara', 'monterey') or 'other'. */
  county: string | null;
  householdSize: number | null;
  incomeUnit: IncomeUnit;
  income: IncomeAnswer | null;
  /** Monthly copay the person typed on the Copay Check, in cents. */
  copayCents: number | null;
  checklist: Record<string, boolean>;
  /** Route to resume after a restart. */
  lastRoute: string | null;
  completedAt: string | null;
  skipped: boolean;
  update: (patch: Partial<ScreenerValues>) => void;
  toggleChecklist: (id: string) => void;
  reset: () => void;
};

export type ScreenerValues = Omit<ScreenerState, 'update' | 'toggleChecklist' | 'reset'>;

export const emptyScreener: ScreenerValues = {
  coverage: null,
  coverageType: null,
  age65: null,
  county: null,
  householdSize: null,
  incomeUnit: 'year',
  income: null,
  copayCents: null,
  checklist: {},
  lastRoute: null,
  completedAt: null,
  skipped: false,
};

export const useScreener = create<ScreenerState>()(
  persist(
    (set) => ({
      ...emptyScreener,
      update: (patch) => set(patch),
      toggleChecklist: (id) => set((s) => ({ checklist: { ...s.checklist, [id]: !s.checklist[id] } })),
      reset: () => set({ ...emptyScreener }),
    }),
    {
      name: STORAGE_KEYS.screener,
      storage: sessionStorage,
      version: 1,
      partialize: ({ update: _u, toggleChecklist: _t, reset: _r, ...rest }) => rest,
    },
  ),
);

/** Maps the screener's answers to the insurance status used by eligibility rules. */
export function insuranceStatusOf(s: Pick<ScreenerValues, 'coverage' | 'coverageType'>) {
  if (s.coverage === 'no') return 'none' as const;
  if (s.coverage === 'unsure' || s.coverage === null) return 'unsure' as const;
  switch (s.coverageType) {
    case 'medi-cal':
      return 'medi-cal' as const;
    case 'medicare':
      return 'medicare' as const;
    case 'private':
      return 'private' as const;
    default:
      return 'other' as const;
  }
}
