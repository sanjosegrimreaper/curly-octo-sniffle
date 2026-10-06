import type { BuyNowOption, PriceSummary } from '@/data/prices';
import { budget, per30DaysCents } from '@/domain';
import type { SavedMedicine } from '@/state/medicines';

/** Why a saved medicine is or isn't in the monthly total. */
export type BudgetReason = 'counted' | 'noPrice' | 'needDays';

export type BudgetLine = {
  key: string;
  summary: PriceSummary | null;
  option: BuyNowOption | null;
  quantity: number;
  /** Days one fill lasts (quantity × days per count), when known. */
  days: number | null;
  monthlyCents: number | null;
  reason: BudgetReason;
};

export type BudgetView = {
  monthlyCents: number;
  known: number;
  noPrice: number;
  needDays: number;
  lines: BudgetLine[];
};

/**
 * Days one count lasts for a saved medicine: from how many the person said they take a day
 * (1 / perDay), else the pack's `daysPerCount`, else unknown. Never guessed.
 */
export function daysPerCountOf(m: Pick<SavedMedicine, 'perDay'>, summary: PriceSummary | null): number | null {
  if (typeof m.perDay === 'number' && Number.isFinite(m.perDay) && m.perDay > 0) return 1 / m.perDay;
  return summary?.strength.daysPerCount ?? null;
}

/** Days one fill lasts, rounded to whole days for display and reminders; null when unknown. */
export function fillDays(m: Pick<SavedMedicine, 'perDay' | 'quantity'>, summary: PriceSummary | null): number | null {
  const d = daysPerCountOf(m, summary);
  return d === null ? null : Math.round(m.quantity * d);
}

/**
 * The monthly budget: the sum of verified Buy-now prices only (the lowest comparable option
 * per medicine), via the domain's `budget()` — so rounding happens once, at the end.
 * Medicines without a listed price, or without a known fill length, are counted, never guessed.
 */
export function budgetView(saved: readonly SavedMedicine[], summaries: readonly (PriceSummary | null)[]): BudgetView {
  const lines: BudgetLine[] = saved.map((m, i) => {
    const summary = summaries[i] ?? null;
    const option = summary?.lowest ?? null;
    const daysPerCount = daysPerCountOf(m, summary);
    const monthlyCents = option ? per30DaysCents(option.priceCents, m.quantity, daysPerCount) : null;
    const reason: BudgetReason = !option ? 'noPrice' : monthlyCents === null ? 'needDays' : 'counted';
    return {
      key: m.key,
      summary,
      option,
      quantity: m.quantity,
      days: daysPerCount === null ? null : Math.round(m.quantity * daysPerCount),
      monthlyCents,
      reason,
    };
  });
  const total = budget(
    saved.map((m, i) => ({
      priceCents: summaries[i]?.lowest?.priceCents ?? null,
      quantity: m.quantity,
      daysPerCount: daysPerCountOf(m, summaries[i] ?? null),
    })),
  );
  return {
    monthlyCents: total.monthlyCents,
    known: total.known,
    noPrice: lines.filter((l) => l.reason === 'noPrice').length,
    needDays: lines.filter((l) => l.reason === 'needDays').length,
    lines,
  };
}
