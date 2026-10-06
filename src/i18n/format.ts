import { LANGUAGES, type Lang } from './languages';

/**
 * Locale for numbers and money. Dollar amounts use US digit grouping in every language
 * (hi-IN would print $1,23,456 — confusing next to US documents and the English column).
 */
function numberTag(lang: Lang) {
  return lang === 'hi' ? 'en-US' : LANGUAGES[lang].intlTag;
}

/** Whole dollars when the amount is a round number of dollars, otherwise cents. */
export function formatMoney(cents: number, lang: Lang, opts: { forceCents?: boolean } = {}) {
  const dollars = cents / 100;
  const whole = Number.isInteger(dollars) && !opts.forceCents;
  return new Intl.NumberFormat(numberTag(lang), {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(dollars);
}

/** Dollar amounts that are already whole dollars (income thresholds). */
export function formatDollars(dollars: number, lang: Lang) {
  return new Intl.NumberFormat(numberTag(lang), {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).format(dollars);
}

/** Per-unit wholesale prices like $0.02792 need more decimals than money. */
export function formatUnitPrice(dollars: number, lang: Lang) {
  return new Intl.NumberFormat(numberTag(lang), {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(dollars);
}

export function formatNumber(n: number, lang: Lang) {
  return new Intl.NumberFormat(numberTag(lang)).format(n);
}

/** YYYY-MM-DD → "Oct 5, 2026" in the user's language. Dates are calendar dates, never shifted by time zone. */
export function formatDate(iso: string, lang: Lang, style: 'medium' | 'long' = 'medium') {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat(LANGUAGES[lang].intlTag, {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatRelativeDays(days: number, lang: Lang) {
  try {
    return new Intl.RelativeTimeFormat(LANGUAGES[lang].intlTag, { numeric: 'auto' }).format(-days, 'day');
  } catch {
    return `${days}`;
  }
}

export function formatPercent(pct: number, lang: Lang) {
  return new Intl.NumberFormat(numberTag(lang), { style: 'percent', maximumFractionDigits: 0 }).format(
    pct / 100,
  );
}
