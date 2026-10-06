import * as fc from 'fast-check';

import { buildIndex, damerauLevenshtein, fuzzyBudget, normalize, search, SCORE } from '../search';
import { MEDICATIONS } from './fixtures';

const index = buildIndex(MEDICATIONS);
const top = (q: string) => search(index, q)[0];

describe('normalize', () => {
  it('lowercases and strips Latin accents', () => {
    expect(normalize('Metformína')).toBe('metformina');
    expect(normalize('ÑANDÚ')).toBe('nandu');
    expect(normalize('Tëstàzol')).toBe('testazol');
  });

  it('folds full-width characters (NFKC)', () => {
    expect(normalize('ＭＥＴＦＯＲＭＩＮ')).toBe('metformin');
    expect(normalize('Ｅｌｉｑｕｉｓ　５ｍｇ')).toBe('eliquis 5mg');
  });

  it('removes punctuation and symbols, collapses spaces', () => {
    expect(normalize('Eliquis®')).toBe('eliquis');
    expect(normalize('Eliquis™')).toBe('eliquis');
    expect(normalize('co-trimoxazole')).toBe('co trimoxazole');
    expect(normalize('  insulin,   glargine. ')).toBe('insulin glargine');
    expect(normalize('a​b')).toBe('ab');
    expect(normalize('')).toBe('');
    expect(normalize(' ¡!¿? ')).toBe('');
  });

  it('keeps Devanagari vowel signs and viramas (they are combining marks too)', () => {
    const hi = 'मेटफॉर्मिन';
    expect(normalize(hi)).toBe(hi.normalize('NFC'));
    expect(normalize(hi)).toContain('े'); // vowel sign E
    expect(normalize(hi)).toContain('्'); // virama
    expect(normalize(hi)).toContain('ि'); // vowel sign I
  });

  it('keeps Han text as is', () => {
    expect(normalize('二甲双胍')).toBe('二甲双胍');
    expect(normalize('二甲双胍，片')).toBe('二甲双胍 片');
  });

  it('is idempotent (property)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (s) => {
        expect(normalize(normalize(s))).toBe(normalize(s));
      }),
    );
  });
});

describe('damerauLevenshtein', () => {
  it('computes edit distance with adjacent transpositions', () => {
    expect(damerauLevenshtein('', '')).toBe(0);
    expect(damerauLevenshtein('abc', '')).toBe(3);
    expect(damerauLevenshtein('metformin', 'metformin')).toBe(0);
    expect(damerauLevenshtein('metfromin', 'metformin')).toBe(1);
    expect(damerauLevenshtein('eliqis', 'eliquis')).toBe(1);
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
    expect(damerauLevenshtein('ca', 'abc')).toBe(3); // OSA, not unrestricted Damerau
  });

  it('counts code points, not UTF-16 units', () => {
    expect(damerauLevenshtein('二甲双胍', '二甲双')).toBe(1);
    expect(damerauLevenshtein('𝒜b', 'b')).toBe(1);
  });

  it('exits early with max + 1', () => {
    expect(damerauLevenshtein('kitten', 'sitting', 1)).toBe(2);
    expect(damerauLevenshtein('a', 'abcdef', 2)).toBe(3);
    expect(damerauLevenshtein('abcdef', 'uvwxyz', 0)).toBe(1);
  });

  it('is a symmetric distance that agrees with the capped version (property)', () => {
    const s = fc.string({ maxLength: 8, unit: fc.constantFrom('a', 'b', 'c', 'd') });
    fc.assert(
      fc.property(s, s, fc.integer({ min: 0, max: 4 }), (a, b, max) => {
        const d = damerauLevenshtein(a, b);
        expect(damerauLevenshtein(b, a)).toBe(d);
        expect(d).toBeLessThanOrEqual(Math.max(a.length, b.length));
        expect(d === 0).toBe(a === b);
        expect(damerauLevenshtein(a, b, max)).toBe(d <= max ? d : max + 1);
      }),
    );
  });
});

describe('fuzzyBudget', () => {
  it('allows 1 edit for 4-6 characters and 2 for 7+', () => {
    expect([1, 3, 4, 6, 7, 20].map(fuzzyBudget)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('buildIndex', () => {
  it('indexes brand, generic, display names and aliases in every language, without duplicates', () => {
    const terms = index.entries.filter((e) => e.medication.id === 'test-metformin').map((e) => e.norm);
    expect(terms).toEqual(['metformin', 'metformina', '二甲双胍', 'मेटफॉर्मिन'.normalize('NFC')]);
    const eliquis = index.entries.filter((e) => e.medication.id === 'test-med-brand').map((e) => e.norm);
    expect(eliquis).toEqual(['eliquis', 'apixaban']);
  });
});

describe('search', () => {
  it.each([
    ['metfromin', 'test-metformin'],
    ['metformina', 'test-metformin'],
    ['二甲双胍', 'test-metformin'],
    ['मेटफॉर्मिन', 'test-metformin'],
    ['eliqis', 'test-med-brand'],
    ['glargine', 'test-glargine'],
    ['Eliquis', 'test-med-brand'],
    ['apixaban', 'test-med-brand'],
    ['ＭＥＴＦＯＲＭＩＮ', 'test-metformin'],
    ['METFORMÍNA', 'test-metformin'],
    ['testazol', 'test-accented'],
    ['atorvastatn', 'test-atorvastatin'],
    ['insulin glargine', 'test-glargine'],
    ['glargine insulin', 'test-glargine'],
  ])('%s → %s', (q, id) => {
    expect(top(q)?.medication.id).toBe(id);
  });

  it('returns nothing for an empty or punctuation-only query', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
    expect(search(index, '?!')).toEqual([]);
  });

  it('scores exact 100, prefix 80, substring 60, fuzzy 40 − 10 × distance', () => {
    expect(top('metformin')).toMatchObject({ score: SCORE.exact, matched: 'metformin' });
    expect(top('metformina')).toMatchObject({ score: 100, matched: 'Metformina' });
    expect(top('metf')).toMatchObject({ score: SCORE.prefix });
    expect(top('glargine')).toMatchObject({ score: 80, matched: 'insulin glargine' });
    expect(top('formin')).toMatchObject({ score: SCORE.substring });
    expect(top('metfromin')).toMatchObject({ score: 30 });
    expect(top('eliqis')).toMatchObject({ score: 30, matched: 'Eliquis' });
    expect(top('metfrmn')).toMatchObject({ score: 20 });
  });

  it('matches Han and Devanagari substrings without spaces', () => {
    expect(top('双胍')).toMatchObject({ score: 60, matched: '二甲双胍' });
    expect(top('甲')).toMatchObject({ medication: { id: 'test-metformin' }, score: 60 });
    expect(top('फॉर्मिन')).toMatchObject({ medication: { id: 'test-metformin' }, score: 60 });
  });

  it('needs 2+ characters for a Latin substring and 4+ for fuzzy', () => {
    expect(search(index, 'q')).toEqual([]); // no prefix, too short for substring
    expect(top('xa')?.medication.id).toBe('test-med-brand'); // apiXAban
    expect(search(index, 'mtf')).toEqual([]); // too short for fuzzy
  });

  it('does not match unrelated words', () => {
    expect(search(index, 'ibuprofen')).toEqual([]);
    expect(search(index, 'zzzzzzzz')).toEqual([]);
  });

  it('returns one result per medication, best score first, then by name', () => {
    const r = search(index, 'a');
    expect(new Set(r.map((x) => x.medication.id)).size).toBe(r.length);
    expect(r.map((x) => [x.medication.displayName.en, x.matched, x.score])).toEqual([
      ['Atorvastatin', 'atorvastatin', 80],
      ['Eliquis', 'apixaban', 80],
    ]);
    const all = search(index, 'in');
    const scores = all.map((x) => x.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const sixties = all.filter((x) => x.score === 60).map((x) => x.medication.displayName.en.toLowerCase());
    expect([...sixties].sort()).toEqual(sixties);
  });

  it('honors the limit', () => {
    expect(search(index, 'in', 1)).toHaveLength(1);
    expect(search(index, 'in', 0)).toEqual([]);
  });

  it('never throws and always returns valid scores (property)', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 20 }), (q) => {
        const r = search(index, q);
        expect(r.length).toBeLessThanOrEqual(10);
        for (const hit of r) expect([100, 80, 60, 30, 20]).toContain(hit.score);
      }),
    );
  });

  it('any indexed term finds its medication with score 100 (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...index.entries), (e) => {
        const r = search(index, e.term, 50);
        expect(r.find((x) => x.medication.id === e.medication.id)?.score).toBe(100);
      }),
    );
  });
});
