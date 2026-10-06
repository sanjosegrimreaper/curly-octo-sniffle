/**
 * Pure helpers for the translation checks (i18n parity, honesty lint).
 */
import { isPlainObject } from './packs';

/** Flattens nested locale JSON to dotted keys. Arrays use numeric segments (`steps.0`). */
export function flatten(value: unknown, prefix = '', out: Map<string, unknown> = new Map()): Map<string, unknown> {
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i), out));
  } else if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.set(prefix, value);
  }
  return out;
}

export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

const PLURAL_RE = /^(.*?)(_ordinal)?_(zero|one|two|few|many|other)$/;

export type KeyInfo =
  | { kind: 'plain'; logical: string }
  | { kind: 'plural'; logical: string; base: string; category: PluralCategory; ordinal: boolean };

/**
 * i18next plural keys (`days_one`, `days_other`, `place_ordinal_two`) collapse to one
 * logical key (`days_{plural}`) so languages with different plural forms still match.
 */
export function keyInfo(key: string): KeyInfo {
  const m = PLURAL_RE.exec(key);
  if (!m || !m[1]) return { kind: 'plain', logical: key };
  const ordinal = Boolean(m[2]);
  const category = PLURAL_CATEGORIES.find((c) => c === m[3]);
  if (!category) return { kind: 'plain', logical: key };
  return {
    kind: 'plural',
    logical: `${m[1]}${ordinal ? '_ordinal' : ''}_{plural}`,
    base: m[1],
    category,
    ordinal,
  };
}

/** Interpolation names in a string: "{{count}} of {{ total, number }}" → ["count", "total"]. */
export function placeholders(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*-?\s*([^}]+?)\s*\}\}/g)) {
    const name = (m[1] ?? '').split(',')[0]?.trim();
    if (name) names.add(name);
  }
  return [...names].sort();
}

/** Plural categories a language needs for cardinal (or ordinal) numbers, per CLDR via Intl. */
export function requiredPluralCategories(lang: string, ordinal = false): PluralCategory[] {
  try {
    const cats = new Intl.PluralRules(lang, { type: ordinal ? 'ordinal' : 'cardinal' }).resolvedOptions()
      .pluralCategories;
    return PLURAL_CATEGORIES.filter((c) => (cats as readonly string[]).includes(c));
  } catch {
    return ['other'];
  }
}

/** Groups flattened keys into logical keys: plain keys map to themselves, plural forms to their family. */
export function logicalKeys(
  flat: ReadonlyMap<string, unknown>,
): Map<string, { forms: Map<string, unknown>; info: KeyInfo }> {
  const out = new Map<string, { forms: Map<string, unknown>; info: KeyInfo }>();
  for (const [key, value] of flat) {
    const info = keyInfo(key);
    const entry = out.get(info.logical) ?? { forms: new Map<string, unknown>(), info };
    entry.forms.set(key, value);
    out.set(info.logical, entry);
  }
  return out;
}
