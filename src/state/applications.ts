import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { sessionStorage, STORAGE_KEYS } from './storage';

export const APPLICATION_STEPS = ['notStarted', 'gathering', 'sent', 'waiting', 'approved', 'denied'] as const;
export type ApplicationStep = (typeof APPLICATION_STEPS)[number];

export type Application = {
  programId: string;
  step: ApplicationStep;
  docs: Record<string, boolean>;
  notes: string;
  referenceNumber: string;
  /** YYYY-MM-DD */
  renewBy: string | null;
  reminderId: string | null;
  updatedAt: string;
};

export type ApplicationsState = {
  byProgram: Record<string, Application>;
  track: (programId: string) => void;
  update: (programId: string, patch: Partial<Omit<Application, 'programId'>>) => void;
  toggleDoc: (programId: string, docIndex: number) => void;
  untrack: (programId: string) => void;
  reset: () => void;
};

const blank = (programId: string): Application => ({
  programId,
  step: 'notStarted',
  docs: {},
  notes: '',
  referenceNumber: '',
  renewBy: null,
  reminderId: null,
  updatedAt: new Date().toISOString(),
});

export const useApplications = create<ApplicationsState>()(
  persist(
    (set) => ({
      byProgram: {},
      track: (programId) =>
        set((s) => (s.byProgram[programId] ? s : { byProgram: { ...s.byProgram, [programId]: blank(programId) } })),
      update: (programId, patch) =>
        set((s) => {
          const current = s.byProgram[programId] ?? blank(programId);
          return {
            byProgram: { ...s.byProgram, [programId]: { ...current, ...patch, updatedAt: new Date().toISOString() } },
          };
        }),
      toggleDoc: (programId, docIndex) =>
        set((s) => {
          const current = s.byProgram[programId] ?? blank(programId);
          const k = String(docIndex);
          return {
            byProgram: {
              ...s.byProgram,
              [programId]: { ...current, docs: { ...current.docs, [k]: !current.docs[k] }, updatedAt: new Date().toISOString() },
            },
          };
        }),
      untrack: (programId) =>
        set((s) => {
          const next = { ...s.byProgram };
          delete next[programId];
          return { byProgram: next };
        }),
      reset: () => set({ byProgram: {} }),
    }),
    {
      name: STORAGE_KEYS.applications,
      storage: sessionStorage,
      version: 1,
      partialize: (s) => ({ byProgram: s.byProgram }),
    },
  ),
);
