import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { sessionStorage, STORAGE_KEYS } from './storage';

export type Selection = {
  drugId: string;
  strengthId: string;
  quantity: number;
  /** How many the person takes a day (optional, used only for per-day/per-month math). */
  perDay?: number | null;
};

export type SavedMedicine = Selection & {
  key: string;
  savedAt: string;
  /** Last Buy-now price we showed, so My Plan can say what changed since last visit. */
  lastSeen: { priceCents: number; snapshotDate: string } | null;
  refill: { notificationId: string; everyDays: number } | null;
};

export type MedicinesState = {
  saved: SavedMedicine[];
  recents: string[];
  lastSelection: Selection | null;
  save: (sel: Selection, lastSeen: SavedMedicine['lastSeen']) => void;
  remove: (key: string) => void;
  isSaved: (sel: Selection) => boolean;
  setLastSeen: (key: string, lastSeen: SavedMedicine['lastSeen']) => void;
  setRefill: (key: string, refill: SavedMedicine['refill']) => void;
  setPerDay: (key: string, perDay: number | null) => void;
  addRecent: (query: string) => void;
  removeRecent: (query: string) => void;
  select: (sel: Selection) => void;
  reset: () => void;
};

export const selectionKey = (s: Selection) => `${s.drugId}:${s.strengthId}:${s.quantity}`;

export const useMedicines = create<MedicinesState>()(
  persist(
    (set, get) => ({
      saved: [],
      recents: [],
      lastSelection: null,
      save: (sel, lastSeen) => {
        const key = selectionKey(sel);
        if (get().saved.some((m) => m.key === key)) return;
        set((s) => ({
          saved: [{ ...sel, key, savedAt: new Date().toISOString(), lastSeen, refill: null }, ...s.saved],
        }));
      },
      remove: (key) => set((s) => ({ saved: s.saved.filter((m) => m.key !== key) })),
      isSaved: (sel) => get().saved.some((m) => m.key === selectionKey(sel)),
      setLastSeen: (key, lastSeen) =>
        set((s) => ({ saved: s.saved.map((m) => (m.key === key ? { ...m, lastSeen } : m)) })),
      setRefill: (key, refill) => set((s) => ({ saved: s.saved.map((m) => (m.key === key ? { ...m, refill } : m)) })),
      setPerDay: (key, perDay) => set((s) => ({ saved: s.saved.map((m) => (m.key === key ? { ...m, perDay } : m)) })),
      addRecent: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({ recents: [q, ...s.recents.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6) }));
      },
      removeRecent: (query) => set((s) => ({ recents: s.recents.filter((r) => r !== query) })),
      select: (sel) => set({ lastSelection: sel }),
      reset: () => set({ saved: [], recents: [], lastSelection: null }),
    }),
    {
      name: STORAGE_KEYS.medicines,
      storage: sessionStorage,
      version: 1,
      partialize: (s) => ({ saved: s.saved, recents: s.recents, lastSelection: s.lastSelection }),
    },
  ),
);
