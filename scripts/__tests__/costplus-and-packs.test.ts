import { isRealDate, todayLocal } from '../lib/cli';
import { dollarsToCents, matchListing, parseCostPlusRows, productPath } from '../lib/costplus';
import { formatPath, isLocalized, readPackRegistry, walk, type PathSeg } from '../lib/packs';

describe('Cost Plus helpers', () => {
  it('parses dollar amounts to cents', () => {
    expect(dollarsToCents('$4.50')).toBe(450);
    expect(dollarsToCents('$1,234.56')).toBe(123456);
    expect(dollarsToCents('$0.07')).toBe(7);
    expect(dollarsToCents('free')).toBeNull();
    expect(dollarsToCents(undefined)).toBeNull();
  });

  it('matches product pages regardless of www and trailing slash', () => {
    expect(productPath('https://www.costplusdrugs.com/medications/X-500mg-Tablet/')).toBe(
      '/medications/x-500mg-tablet',
    );
    expect(productPath('https://example.com/medications/x/')).toBeNull();
    const parsed = parseCostPlusRows({
      results: [
        {
          ndc: '16729017117',
          url: 'https://costplusdrugs.com/medications/amitriptyline-10mg-tablet/',
          unit_price: '$0.050',
        },
        { url: 'missing ndc' },
      ],
    });
    expect(parsed?.rejected).toBe(1);
    expect(
      matchListing(parsed?.rows ?? [], 'https://www.costplusdrugs.com/medications/amitriptyline-10mg-tablet'),
    ).toHaveLength(1);
    expect(parseCostPlusRows({ nope: [] })).toBeNull();
  });
});

describe('pack helpers', () => {
  it('validates calendar dates', () => {
    expect(isRealDate('2026-02-28')).toBe(true);
    expect(isRealDate('2026-02-29')).toBe(false);
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isRealDate('2026-13-01')).toBe(false);
    expect(todayLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('recognizes localized text objects', () => {
    expect(isLocalized({ en: 'Hi', es: 'Hola', 'zh-Hans': '你好' })).toBe(true);
    expect(isLocalized({ en: ['a'] })).toBe(false);
    expect(isLocalized({ en: 'x', label: 'y' })).toBe(false);
  });

  it('labels array items by id in key paths', () => {
    const paths: string[] = [];
    walk({ programs: [{ id: 'bmspaf', description: { en: 'x' } }, { name: 'n' }] }, (v, at: readonly PathSeg[]) => {
      if (typeof v === 'string') paths.push(formatPath(at));
    });
    expect(paths).toEqual(['programs[bmspaf].id', 'programs[bmspaf].description.en', 'programs[1].name']);
  });

  it('reads PACK_FILES from src/data/pack.ts', () => {
    const registry = readPackRegistry();
    expect(registry?.get('ca-south-bay')).toEqual(
      expect.arrayContaining(['manifest.json', 'medications.json', 'prices/nadac.json']),
    );
  });
});
