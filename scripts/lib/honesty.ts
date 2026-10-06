/**
 * Forbidden absolute claims, per language (Honesty Contract §5: hedge everything predictive
 * or about eligibility — "may qualify", "could drop"; never "you qualify", "guaranteed").
 *
 * Matching is case-insensitive on NFC-normalized text. Latin phrases must start at a word
 * boundary ("approved" matches "pre-approved" but not "unapproved"); CJK and Devanagari
 * phrases match anywhere. English rules also apply to every other language, so English
 * left untranslated in a translation is still caught.
 */

export const FORBIDDEN: Readonly<Record<string, readonly string[]>> = {
  en: [
    'guaranteed',
    'guarantee',
    'you qualify',
    'you are eligible',
    "you're eligible",
    'you will save',
    'will save you',
    'approved',
    '100%',
    'always the lowest',
    'best price',
    'cheapest',
    'free medicine for everyone',
  ],
  es: [
    'garantizado',
    'garantizada',
    'garantizados',
    'garantizadas',
    'garantizamos',
    'usted califica',
    'califica para',
    'ahorrará',
    'ahorrarás',
    'aprobado',
    'aprobada',
  ],
  'zh-Hans': ['保证', '一定能', '您符合资格', '你符合资格', '肯定'],
  hi: ['गारंटी', 'पक्का', 'आप पात्र हैं', 'ज़रूर बचत', 'जरूर बचत'],
};

/**
 * Wording that contains a listed phrase but is a regulatory fact, not a promise to the user:
 * "FDA-approved", "approved by the FDA", "aprobado por la FDA". Masked before matching.
 */
export const EXEMPT: Readonly<Record<string, readonly RegExp[]>> = {
  en: [/\bFDA[-\s]approved\b/giu, /\bapproved by (?:the )?(?:U\.S\. )?(?:FDA|Food and Drug Administration)\b/giu],
  es: [/\baprobad[oa]s? por la (?:FDA|Administración de Alimentos y Medicamentos)\b/giu],
};

/** "will" right next to a promise verb, in English ("will save", "you'll qualify", "will not drop"). */
export const WILL_PROMISE = /(?:\bwill|['’]ll)\s+(?:not\s+)?(?:drop|save|qualify|approve|launch)(?:s|d|ed|ing)?\b/giu;

/** "cheaper" is only allowed hedged: "may be cheaper", "could be cheaper", "often cheaper". */
const CHEAPER = /\bcheaper\b/giu;
const HEDGE_BEFORE = /\b(may|might|could|can|often|sometimes|usually|possibly|perhaps|likely)\b(?:\s+\S+){0,3}\s*$/iu;

export type Finding = { phrase: string; index: number; rule: 'phrase' | 'will' | 'cheaper' };

const norm = (s: string) => s.normalize('NFC').toLowerCase();
const isLatinStart = (s: string) => /^[a-z0-9]/i.test(s);
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;

function phraseHits(text: string, phrases: readonly string[]): Finding[] {
  const hay = norm(text);
  const out: Finding[] = [];
  for (const raw of phrases) {
    const needle = norm(raw);
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
      if (isLatinStart(needle) && i > 0 && WORD_CHAR.test(hay[i - 1] ?? '')) continue;
      out.push({ phrase: raw, index: i, rule: 'phrase' });
    }
  }
  return out;
}

/** Drops matches covered by a longer match that starts at the same place ("guarantee" inside "guaranteed"). */
function dedupe(found: Finding[]): Finding[] {
  const sorted = [...found].sort((a, b) => a.index - b.index || b.phrase.length - a.phrase.length);
  const kept: Finding[] = [];
  let coveredUntil = -1;
  for (const f of sorted) {
    if (f.index < coveredUntil) continue;
    kept.push(f);
    coveredUntil = f.index + f.phrase.length;
  }
  return kept;
}

/** Blanks out exempt spans (same length, so indexes still point into the original text). */
function maskExempt(text: string, lang: string): string {
  let out = text;
  for (const re of [...(EXEMPT[lang] ?? []), ...(lang === 'en' ? [] : (EXEMPT.en ?? []))]) {
    out = out.replace(re, (m) => ' '.repeat(m.length));
  }
  return out;
}

/** Every forbidden claim in `text`, written in language `lang`. */
export function findForbidden(original: string, lang: string): Finding[] {
  const text = maskExempt(original, lang);
  const lists = lang === 'en' ? [FORBIDDEN.en ?? []] : [FORBIDDEN[lang] ?? [], FORBIDDEN.en ?? []];
  const found = lists.flatMap((l) => phraseHits(text, l));
  if (lang === 'en') {
    for (const m of text.matchAll(WILL_PROMISE)) found.push({ phrase: m[0], index: m.index ?? 0, rule: 'will' });
    for (const m of text.matchAll(CHEAPER)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      if (!HEDGE_BEFORE.test(before)) found.push({ phrase: m[0], index: m.index ?? 0, rule: 'cheaper' });
    }
  }
  return dedupe(found);
}

export function hasRulesFor(lang: string): boolean {
  return lang in FORBIDDEN;
}
