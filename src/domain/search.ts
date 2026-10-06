/**
 * Multilingual medicine search: brand and generic names, display names and every
 * per-language alias in the pack, across Latin, Han and Devanagari scripts.
 * Ranking: exact (100) → token/prefix (80) → substring (60) → fuzzy (40 − 10 × distance).
 */
import type { Medication } from '@/data/schemas';

/** One searchable term of a medication. */
export type SearchEntry = {
  medication: Medication;
  /** The term as written in the pack (shown as "matched"). */
  term: string;
  /** `normalize(term)` */
  norm: string;
  /** `norm` without spaces, so "co-trimoxazole" matches "cotrimoxazole". */
  compact: string;
  /** Space-separated words of `norm`. */
  tokens: string[];
};

/** Prebuilt search index (build once per pack with `buildIndex`). */
export type SearchIndex = { entries: SearchEntry[] };

/** One search hit, best score per medication. */
export type SearchResult = { medication: Medication; score: number; matched: string };

/** Scores per match kind. */
export const SCORE = { exact: 100, prefix: 80, substring: 60, fuzzy: 40 } as const;

const MARK = /\p{M}/u;
const LATIN = /\p{Script=Latin}/u;
const HAN = /\p{Script=Han}/u;

const nf = (s: string, form: 'NFC' | 'NFD' | 'NFKC') => (typeof s.normalize === 'function' ? s.normalize(form) : s);

/**
 * Normalizes text for matching: compatibility forms (NFKC: full-width → ASCII),
 * lowercase, accents removed from Latin letters only (Devanagari vowel signs and
 * viramas are combining marks too, and they must stay), punctuation and symbols
 * removed, whitespace collapsed.
 */
export function normalize(s: string): string {
  // Symbols first: NFKC would otherwise turn "™" into the letters "TM".
  const lowered = nf(s.replace(/\p{S}/gu, ' '), 'NFKC').toLowerCase();
  let out = '';
  let latinBase = false;
  for (const ch of nf(lowered, 'NFD')) {
    if (MARK.test(ch)) {
      if (!latinBase) out += ch;
      continue;
    }
    latinBase = LATIN.test(ch);
    out += ch;
  }
  return nf(out, 'NFC')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Damerau-Levenshtein distance (optimal string alignment: insertions, deletions,
 * substitutions and adjacent transpositions), counted in Unicode code points.
 * Stops early once the distance must exceed `max` and then returns `max + 1`.
 */
export function damerauLevenshtein(a: string, b: string, max: number = Infinity): number {
  const s = Array.from(a);
  const t = Array.from(b);
  const n = s.length;
  const m = t.length;
  if (Math.abs(n - m) > max) return max + 1;
  if (n === 0 || m === 0) return Math.max(n, m);
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  const d = prev[m]!;
  return d > max ? max + 1 : d;
}

const compactOf = (norm: string) => norm.replace(/ /g, '');

/** Every searchable term of a medication, as written in the pack. */
function termsOf(med: Medication): string[] {
  const terms: string[] = [];
  if (med.brand) terms.push(med.brand);
  terms.push(med.generic);
  for (const v of Object.values(med.displayName)) if (v) terms.push(v);
  for (const list of Object.values(med.aliases)) terms.push(...list);
  return terms;
}

/** Builds the index: every brand, generic, display name and alias in every language, normalized. */
export function buildIndex(medications: readonly Medication[]): SearchIndex {
  const entries: SearchEntry[] = [];
  for (const medication of medications) {
    const seen = new Set<string>();
    for (const term of termsOf(medication)) {
      const norm = normalize(term);
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      entries.push({ medication, term, norm, compact: compactOf(norm), tokens: norm.split(' ') });
    }
  }
  return { entries };
}

/** Largest edit distance tolerated for a query of `len` code points (0 = no fuzzy matching). */
export function fuzzyBudget(len: number): number {
  if (len >= 7) return 2;
  if (len >= 4) return 1;
  return 0;
}

const prefixOf = (s: string, len: number) => Array.from(s).slice(0, len).join('');

type Query = { norm: string; compact: string; tokens: string[]; len: number; substringOk: boolean; maxD: number };

function scoreEntry(q: Query, e: SearchEntry): number {
  if (q.norm === e.norm || q.compact === e.compact) return SCORE.exact;
  if (
    e.norm.startsWith(q.norm) ||
    e.compact.startsWith(q.compact) ||
    q.tokens.every((qt) => e.tokens.some((t) => t.startsWith(qt)))
  ) {
    return SCORE.prefix;
  }
  if (q.substringOk && e.compact.includes(q.compact)) return SCORE.substring;
  if (q.maxD === 0) return 0;
  const candidates = [e.compact, ...e.tokens];
  let best = q.maxD + 1;
  for (const c of candidates) {
    best = Math.min(
      best,
      damerauLevenshtein(q.compact, c, q.maxD),
      damerauLevenshtein(q.compact, prefixOf(c, q.len), q.maxD),
    );
    if (best === 0) break;
  }
  return best <= q.maxD ? SCORE.fuzzy - 10 * best : 0;
}

/**
 * Searches the index. Returns at most `limit` medications with their best score and
 * the term that matched, sorted by score (high first) then English display name.
 * Substring matching needs 1+ characters for Han queries and 2+ otherwise; fuzzy
 * matching allows 1 edit for 4-6 characters and 2 edits for 7+.
 */
export function search(index: SearchIndex, query: string, limit: number = 10): SearchResult[] {
  const norm = normalize(query);
  if (!norm || limit <= 0) return [];
  const compact = compactOf(norm);
  const len = Array.from(compact).length;
  const q: Query = {
    norm,
    compact,
    tokens: norm.split(' '),
    len,
    substringOk: len >= (HAN.test(compact) ? 1 : 2),
    maxD: fuzzyBudget(len),
  };
  const best = new Map<string, SearchResult>();
  for (const e of index.entries) {
    const score = scoreEntry(q, e);
    if (score <= 0) continue;
    const prev = best.get(e.medication.id);
    if (!prev || score > prev.score) best.set(e.medication.id, { medication: e.medication, score, matched: e.term });
  }
  const name = (m: Medication) => m.displayName.en.toLowerCase();
  return [...best.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const na = name(a.medication);
      const nb = name(b.medication);
      return na < nb
        ? -1
        : na > nb
          ? 1
          : a.medication.id < b.medication.id
            ? -1
            : a.medication.id > b.medication.id
              ? 1
              : 0;
    })
    .slice(0, limit);
}
