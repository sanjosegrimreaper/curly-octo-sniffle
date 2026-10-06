/**
 * Storage adapter for persisted stores. AsyncStorage works in Expo Go, on device builds and on web.
 * Swap this module for an MMKV-backed adapter in a dev build if write volume ever matters.
 *
 * Navigator mode: client data must never touch disk, so `sessionStorage()` writes become no-ops
 * while it is on (see settings.navigatorMode).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const safe: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Storage full or unavailable (private browsing). The app keeps working in memory.
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

export const appStorage = createJSONStorage(() => safe);

let ephemeral = false;
/** Called by the settings store when navigator mode changes. */
export function setEphemeral(on: boolean) {
  ephemeral = on;
}
export function isEphemeral() {
  return ephemeral;
}

/** For stores that hold personal answers: skips writes in navigator mode. */
export const sessionStorage = createJSONStorage(() => ({
  getItem: safe.getItem,
  setItem: (name: string, value: string) => (ephemeral ? undefined : safe.setItem(name, value)),
  removeItem: safe.removeItem,
}));

export const STORAGE_KEYS = {
  settings: 'rxb.settings.v1',
  screener: 'rxb.screener.v1',
  medicines: 'rxb.medicines.v1',
  applications: 'rxb.applications.v1',
  feeds: 'rxb.feeds.v1',
} as const;

export async function clearAllPersonalData() {
  await Promise.all(
    [STORAGE_KEYS.screener, STORAGE_KEYS.medicines, STORAGE_KEYS.applications].map((k) => safe.removeItem(k)),
  );
}
