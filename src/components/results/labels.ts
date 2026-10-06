/**
 * Small display helpers shared by search, the strength picker, results, the counter card
 * and the share summary. Pure (no React), so they work with any fixed-language `t`.
 */
import type { TFunction } from 'i18next';

import { loc } from '@/data/localize';
import type { Medication, Strength } from '@/data/schemas';
import { perDayCentsFromDaily } from '@/domain';
import { i18next } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import type { Lang } from '@/i18n/languages';

export type ResultsT = TFunction<'results'>;

/** A fixed-language `t` for the results namespace (like `tFor(lang)`), for bilingual screens and handouts. */
export const resultsT = (lang: Lang): ResultsT => i18next.getFixedT(lang, 'results');

/** Count units the pack uses for `countLabel.en`, with real singular/plural strings. */
const COUNT_UNITS = ['tablets', 'capsules', 'boxes', 'vials', 'pens'] as const;
type CountUnit = (typeof COUNT_UNITS)[number];
const isCountUnit = (u: string): u is CountUnit => (COUNT_UNITS as readonly string[]).includes(u);

/** "60 tablets", "1 box" — falls back to "<n> <countLabel>" for units we have no plural strings for. */
export function countText(t: ResultsT, strength: Pick<Strength, 'countLabel'>, count: number, lang: Lang): string {
  const unit = strength.countLabel.en.trim().toLowerCase();
  if (isCountUnit(unit)) return t(`count.${unit}`, { count });
  return t('count.generic', { count: formatNumber(count, lang), unit: loc(strength.countLabel, lang) });
}

/** "5 mg tablet × 60 tablets" */
export function selectionText(t: ResultsT, strength: Strength, quantity: number, lang: Lang): string {
  return t('selection', { strength: loc(strength.label, lang), qty: countText(t, strength, quantity, lang) });
}

/** Brand in bold + generic, or the pack's display name when there is no brand. */
export function medTitle(med: Medication, lang: Lang): { primary: string; secondary: string | null } {
  if (med.brand) return { primary: med.brand, secondary: med.generic };
  return { primary: loc(med.displayName, lang), secondary: null };
}

/** Forms where "how many do you take a day" makes sense (counted by the piece). */
export function asksPerDay(strength: Pick<Strength, 'form'>): boolean {
  return strength.form === 'tablet' || strength.form === 'tablet-er' || strength.form === 'capsule';
}

/** Price of one count (tablet, box…) in exact dollars, via the domain price math (never rounded here). */
export function eachDollars(priceCents: number, quantity: number): number | null {
  // perDayCentsFromDaily with 1 count a day = cents per count.
  const cents = perDayCentsFromDaily(priceCents, quantity, 1);
  return cents === null ? null : cents / 100;
}

/** Days a fill lasts at `perDay` counts a day, rounded down ("about N days"). Null when unknown. */
export function daysLasting(quantity: number, perDay: number | null | undefined): number | null {
  if (!perDay || perDay <= 0 || !Number.isFinite(quantity) || quantity <= 0) return null;
  return Math.floor(quantity / perDay);
}

/** Host name for "Open example.org" button labels (a button names where it goes). */
export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
