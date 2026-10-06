import type { ReactNode } from 'react';
import { create } from 'zustand';

import type { SourceRef } from '@/data/schemas';

export type SheetContent =
  | { kind: 'source'; title: string; sources: SourceRef[]; verifiedAsOf: string; recordId: string }
  | { kind: 'glossary'; termId: string }
  | { kind: 'custom'; title: string; render: () => ReactNode };

type UiState = {
  sheet: SheetContent | null;
  toast: { id: number; message: string; tone: 'info' | 'success' | 'caution' } | null;
  openSheet: (s: SheetContent) => void;
  closeSheet: () => void;
  showToast: (message: string, tone?: 'info' | 'success' | 'caution') => void;
  hideToast: () => void;
};

let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  sheet: null,
  toast: null,
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  showToast: (message, tone = 'info') => set({ toast: { id: ++toastId, message, tone } }),
  hideToast: () => set({ toast: null }),
}));
