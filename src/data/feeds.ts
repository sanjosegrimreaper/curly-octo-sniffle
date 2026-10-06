/**
 * Remote price feeds. The app always works with the bundled snapshot; a newer, valid
 * feed fetched from the network only replaces it when its as-of date is newer.
 * Any failure (offline, timeout, bad JSON, schema mismatch) silently keeps what we have.
 */
import Constants from 'expo-constants';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchJson, parseFeed, resolveFeed } from '@/domain/feedResolution';
import { appStorage, STORAGE_KEYS } from '@/state/storage';

import { getPack } from './pack';
import type { NadacFeed } from './schemas';

type FeedState = {
  nadacCached: NadacFeed | null;
  lastCheckedAt: string | null;
  setCached: (feed: NadacFeed) => void;
  setChecked: (iso: string) => void;
};

export const useFeeds = create<FeedState>()(
  persist(
    (set) => ({
      nadacCached: null,
      lastCheckedAt: null,
      setCached: (feed) => set({ nadacCached: feed }),
      setChecked: (iso) => set({ lastCheckedAt: iso }),
    }),
    {
      name: STORAGE_KEYS.feeds,
      storage: appStorage,
      version: 1,
      partialize: (s) => ({ nadacCached: s.nadacCached, lastCheckedAt: s.lastCheckedAt }),
    },
  ),
);

function nadacUrl(): string | null {
  const extra = Constants.expoConfig?.extra as { feeds?: { nadacUrl?: string } } | undefined;
  return extra?.feeds?.nadacUrl ?? null;
}

/** Called on launch (skipped in low-data mode). Never throws. */
export async function refreshFeeds() {
  const url = nadacUrl();
  if (!url) return;
  try {
    const json = await fetchJson(url, { timeoutMs: 6000, retries: 2 });
    const remote = json ? parseFeed(json) : null;
    if (remote) {
      const { feed, source } = resolveFeed({
        bundled: getPack().nadac,
        cached: useFeeds.getState().nadacCached,
        remote,
      });
      if (source === 'remote') useFeeds.getState().setCached(feed);
    }
    useFeeds.getState().setChecked(new Date().toISOString());
  } catch {
    // keep bundled/cached
  }
}

/** The NADAC feed to show: newest valid of bundled and cached. */
export function useNadacFeed(): NadacFeed {
  const cached = useFeeds((s) => s.nadacCached);
  return resolveFeed({ bundled: getPack().nadac, cached: cached ? parseFeed(cached) : null, remote: null }).feed;
}
