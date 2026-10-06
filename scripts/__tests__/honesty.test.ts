import { findForbidden } from '../lib/honesty';

const phrases = (text: string, lang = 'en') => findForbidden(text, lang).map((f) => f.phrase.toLowerCase());

describe('honesty lint matcher', () => {
  it('allows hedged wording', () => {
    expect(phrases('You may qualify for Medi-Cal.')).toEqual([]);
    expect(phrases('Prices could drop when a generic launches.')).toEqual([]);
    expect(phrases('Cost Plus may be cheaper than your copay.')).toEqual([]);
    expect(phrases('This is an estimate, not a decision.')).toEqual([]);
  });

  it('flags absolute claims', () => {
    expect(phrases('You qualify for this program!')).toEqual(['you qualify']);
    expect(phrases('Savings are GUARANTEED.')).toEqual(['guaranteed']); // not also "guarantee"
    expect(phrases('Your application is approved')).toEqual(['approved']);
    expect(phrases('The best price in town')).toEqual(['best price']);
    expect(phrases('This is cheaper.')).toEqual(['cheaper']);
  });

  it('flags "will" promises in English', () => {
    expect(phrases('The price will drop next year')).toEqual(['will drop']);
    expect(phrases("You'll save $40")).toEqual(["'ll save"]);
    expect(phrases('This will save you money')).toEqual(['will save you']);
  });

  it('respects word starts and regulatory exemptions', () => {
    expect(phrases('An unapproved use')).toEqual([]);
    expect(phrases('Generic apixaban is FDA-approved.')).toEqual([]);
    expect(phrases('aprobado por la FDA', 'es')).toEqual([]);
  });

  it('uses per-language lists (plus English)', () => {
    expect(phrases('Usted califica para Medi-Cal', 'es')).toEqual(['usted califica']);
    expect(phrases('Ahorrará dinero', 'es')).toEqual(['ahorrará']);
    expect(phrases('我们保证价格', 'zh-Hans')).toEqual(['保证']);
    expect(phrases('आप पात्र हैं', 'hi')).toEqual(['आप पात्र हैं']);
    // Nukta written as two code points still matches after NFC normalization.
    expect(phrases('ज़रूर बचत होगी', 'hi')).toHaveLength(1);
    // English left untranslated in a Spanish string is still caught.
    expect(phrases('Precio guaranteed', 'es')).toEqual(['guaranteed']);
  });
});
