import type { BuyNowOption, PriceSummary } from '@/data/prices';
import type { SavedMedicine } from '@/state/medicines';

/** A Buy-now price that differs from the one we showed last time. */
export type PriceChange = {
  key: string;
  summary: PriceSummary;
  option: BuyNowOption;
  fromCents: number;
  toCents: number;
};

/**
 * Buy-now prices only: for each saved medicine with a lowest Buy-now price today and a
 * remembered `lastSeen`, report it when the amount changed. Nothing is reported for a
 * medicine we never showed a price for, and nothing is ever estimated.
 */
export function priceChanges(saved: readonly SavedMedicine[], summaries: readonly (PriceSummary | null)[]): PriceChange[] {
  const out: PriceChange[] = [];
  saved.forEach((m, i) => {
    const summary = summaries[i];
    const option = summary?.lowest;
    if (!summary || !option || !m.lastSeen) return;
    if (m.lastSeen.priceCents === option.priceCents) return;
    out.push({ key: m.key, summary, option, fromCents: m.lastSeen.priceCents, toCents: option.priceCents });
  });
  return out;
}

/** The `lastSeen` value to remember for today's lowest Buy-now price (null when there is none). */
export function lastSeenFor(option: BuyNowOption | null | undefined): SavedMedicine['lastSeen'] {
  if (!option) return null;
  return { priceCents: option.priceCents, snapshotDate: option.snapshotDate ?? option.verifiedAsOf };
}

/** Saved medicines whose remembered price should be updated to today's. */
export function staleLastSeen(
  saved: readonly SavedMedicine[],
  summaries: readonly (PriceSummary | null)[],
): { key: string; lastSeen: NonNullable<SavedMedicine['lastSeen']> }[] {
  const out: { key: string; lastSeen: NonNullable<SavedMedicine['lastSeen']> }[] = [];
  saved.forEach((m, i) => {
    const next = lastSeenFor(summaries[i]?.lowest);
    if (!next) return;
    if (m.lastSeen && m.lastSeen.priceCents === next.priceCents && m.lastSeen.snapshotDate === next.snapshotDate) return;
    out.push({ key: m.key, lastSeen: next });
  });
  return out;
}
