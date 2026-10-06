import type { Lang } from '@/i18n/languages';

import type { Localized } from './schemas';

/** Picks the user's language; falls back to English and says so (so we never pretend a translation exists). */
export function pickLocalized(value: Localized, lang: Lang): { text: string; fellBack: boolean } {
  const v = value[lang];
  if (v) return { text: v, fellBack: false };
  return { text: value.en, fellBack: lang !== 'en' };
}

export function loc(value: Localized | null | undefined, lang: Lang): string {
  if (!value) return '';
  return pickLocalized(value, lang).text;
}
