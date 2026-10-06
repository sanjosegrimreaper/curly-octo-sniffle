import { useMemo } from 'react';

import { useNadacFeed } from '@/data/feeds';
import { getPack } from '@/data/pack';
import { priceSummary, type PriceSummary } from '@/data/prices';
import { todayISO } from '@/domain';
import { useTheme } from '@/design';
import type { Selection } from '@/state/medicines';

/** Price summary for one selection (null if the medicine or strength isn't in the pack). */
export function usePriceSummary(sel: Selection | null): PriceSummary | null {
  const feed = useNadacFeed();
  const { lang } = useTheme();
  return useMemo(
    () => (sel ? priceSummary(getPack(), feed, sel, lang, todayISO()) : null),
    [sel, feed, lang],
  );
}

/** Price summaries for many selections (My medicines, My Plan). */
export function usePriceSummaries(sels: Selection[]): (PriceSummary | null)[] {
  const feed = useNadacFeed();
  const { lang } = useTheme();
  return useMemo(() => {
    const today = todayISO();
    return sels.map((s) => priceSummary(getPack(), feed, s, lang, today));
  }, [sels, feed, lang]);
}
