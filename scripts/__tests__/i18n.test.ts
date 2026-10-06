import { flatten, keyInfo, logicalKeys, placeholders, requiredPluralCategories } from '../lib/i18n';

describe('i18n helpers', () => {
  it('flattens nested objects and arrays', () => {
    const flat = flatten({ a: { b: 'x', c: ['y', 'z'] }, d: 'w' });
    expect([...flat.entries()]).toEqual([
      ['a.b', 'x'],
      ['a.c.0', 'y'],
      ['a.c.1', 'z'],
      ['d', 'w'],
    ]);
  });

  it('groups plural forms into one logical key', () => {
    expect(keyInfo('fresh_one')).toMatchObject({ kind: 'plural', logical: 'fresh_{plural}', category: 'one' });
    expect(keyInfo('fresh_other').logical).toBe('fresh_{plural}');
    expect(keyInfo('place_ordinal_two')).toMatchObject({
      kind: 'plural',
      ordinal: true,
      logical: 'place_ordinal_{plural}',
    });
    expect(keyInfo('appName')).toEqual({ kind: 'plain', logical: 'appName' });

    // en needs one+other, zh only other: same logical key set.
    const en = logicalKeys(
      new Map([
        ['days_one', '1 day'],
        ['days_other', '{{count}} days'],
        ['title', 'T'],
      ]),
    );
    const zh = logicalKeys(
      new Map([
        ['days_other', '{{count}} 天'],
        ['title', '标题'],
      ]),
    );
    expect([...en.keys()].sort()).toEqual([...zh.keys()].sort());
  });

  it('extracts interpolation names', () => {
    expect(placeholders('{{count}} of {{ total, number }} — {{- raw}}')).toEqual(['count', 'raw', 'total']);
    expect(placeholders('no placeholders')).toEqual([]);
  });

  it('knows which plural forms a language uses', () => {
    expect(requiredPluralCategories('zh-Hans')).toEqual(['other']);
    expect(requiredPluralCategories('en')).toEqual(['one', 'other']);
    expect(requiredPluralCategories('hi')).toEqual(['one', 'other']);
  });
});
