import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Lang } from '@/i18n/languages';

import { appStorage, setEphemeral, STORAGE_KEYS } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'on' | 'off';
export type TextSize = 'default' | 'large' | 'larger';

export type SettingsState = {
  /** null until the person picks a language on the welcome screen. */
  language: Lang | null;
  themeMode: ThemeMode;
  highContrast: boolean;
  /** 'on' = reduce motion, 'off' = full motion, 'system' = follow the OS. */
  reduceMotion: MotionPref;
  haptics: boolean;
  textSize: TextSize;
  speechRate: number;
  navigatorMode: boolean;
  /** Navigator mode: the language handouts/scripts are produced in. */
  clientLanguage: Lang | null;
  lowData: boolean;
  appLock: boolean;
  /** Reminders say "Time to refill a medicine" without naming it, unless turned off. */
  privateNotifications: boolean;
  lastOpenedAt: string | null;
  set: <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => void;
  reset: () => void;
};

export type SettingsValues = Omit<SettingsState, 'set' | 'reset'>;

export const defaultSettings: SettingsValues = {
  language: null,
  themeMode: 'system',
  highContrast: false,
  reduceMotion: 'system',
  haptics: true,
  textSize: 'default',
  speechRate: 0.95,
  navigatorMode: false,
  clientLanguage: null,
  lowData: false,
  appLock: false,
  privateNotifications: true,
  lastOpenedAt: null,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      set: (key, value) => {
        if (key === 'navigatorMode') setEphemeral(Boolean(value));
        set({ [key]: value } as Partial<SettingsState>);
      },
      reset: () => set({ ...defaultSettings }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: appStorage,
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) setEphemeral(state.navigatorMode);
      },
      partialize: ({ set: _set, reset: _reset, ...rest }) => rest,
    },
  ),
);

export const textSizeMultiplier: Record<TextSize, number> = { default: 1, large: 1.15, larger: 1.3 };
