import type { Href } from 'expo-router';

import { loc } from '@/data/localize';
import type { Medication, Strength } from '@/data/schemas';
import type { Lang } from '@/i18n/languages';
import type { Selection } from '@/state/medicines';

/** "Eliquis (apixaban)" in the person's language (English fallback). */
export function medicineName(med: Medication, lang: Lang): string {
  return loc(med.displayName, lang);
}

/** Short name for tight places: the brand when there is one, else the display name. */
export function shortName(med: Medication, lang: Lang): string {
  return med.brand ?? loc(med.displayName, lang);
}

/**
 * "5 mg tablet × 60 tablets". The pack's count label is plural ("tablets", "boxes"), so a
 * quantity of 1 is written "× 1" instead of a wrong plural.
 */
export function packageLabel(strength: Strength, quantity: number, lang: Lang): string {
  const label = loc(strength.label, lang);
  return quantity === 1 ? `${label} × 1` : `${label} × ${quantity} ${loc(strength.countLabel, lang)}`;
}

/** Results screen for one saved selection (Prices | Help paying). */
export function resultsHref(sel: Pick<Selection, 'drugId' | 'strengthId' | 'quantity'>): Href {
  return `/drug/${encodeURIComponent(sel.drugId)}/results?strength=${encodeURIComponent(sel.strengthId)}&qty=${sel.quantity}` as Href;
}

/** Hostname without "www." for link labels ("Website: coveredca.com"). */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Local hour → greeting key. */
export function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
