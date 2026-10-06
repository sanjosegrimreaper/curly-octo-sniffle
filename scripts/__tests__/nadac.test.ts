import { nadacFeedSchema } from '../../src/data/schemas';
import {
  buildFeed,
  isExcludedForKey,
  nadacDatasets,
  parseRows,
  summarizeKey,
  toIsoDate,
  type NadacFeed,
} from '../lib/nadac';

const row = (
  ndc: string,
  perUnit: string,
  asOf: string,
  eff = '2026-09-10',
  desc = 'METFORMIN HCL ER 500 MG TABLET',
) => ({
  ndc_description: desc,
  ndc,
  nadac_per_unit: perUnit,
  effective_date: eff,
  pricing_unit: 'EA',
  as_of_date: asOf,
  classification_for_rate_setting: 'G',
});

describe('NADAC refresh logic', () => {
  it('normalizes DKAN dates', () => {
    expect(toIsoDate('2026-09-30')).toBe('2026-09-30');
    expect(toIsoDate('2026-09-30T00:00:00')).toBe('2026-09-30');
    expect(toIsoDate('9/3/2026')).toBe('2026-09-03');
    expect(toIsoDate('2026-02-30')).toBeNull();
    expect(toIsoDate('soon')).toBeNull();
  });

  it('rejects malformed rows', () => {
    const { rows, rejected } = parseRows([
      row('00093726701', '0.03', '2026-09-30'),
      row('123', '0.03', '2026-09-30'),
      row('00093726702', 'n/a', '2026-09-30'),
    ]);
    expect(rows).toHaveLength(1);
    expect(rejected).toBe(2);
  });

  it('uses the newest weekly file and the median across NDCs', () => {
    const { rows } = parseRows([
      row('00000000001', '0.04000', '2026-09-23'), // older week: ignored
      row('00000000001', '0.03011', '2026-09-30'),
      row('00000000002', '0.02950', '2026-09-30', '2026-09-24'),
      row('00000000003', '0.03500', '2026-09-30'),
      row('00000000004', '9.99000', '2026-09-30', '2026-09-10', 'METFORMIN HCL ER 500 MG TABLET OSM'),
    ]);
    const s = summarizeKey('METFORMIN HCL ER 500 MG TABLET', rows);
    expect(s?.asOfDate).toBe('2026-09-30');
    expect(s?.ndcCount).toBe(3);
    expect(s?.entry).toMatchObject({ perUnit: 0.03011, ndc: '00000000001', pricingUnit: 'EA', classification: 'G' });
    expect(s?.entry.note).toMatch(/Median of 3 NDCs/);
    expect(summarizeKey('ELIQUIS 5 MG TABLET', rows)).toBeNull();
  });

  it('averages the two middle prices for an even number of NDCs', () => {
    const { rows } = parseRows([
      row('00000000001', '0.01000', '2026-09-30'),
      row('00000000002', '0.02000', '2026-09-30'),
    ]);
    expect(summarizeKey('METFORMIN HCL ER 500 MG TABLET', rows)?.entry.perUnit).toBe(0.015);
  });

  it('excludes osmotic / gastric-retentive rows unless the key asks for them', () => {
    expect(isExcludedForKey('METFORMIN HCL ER 500 MG TABLET', 'METFORMIN ER OSM 500 MG TAB')).toBe(true);
    expect(isExcludedForKey('METFORMIN ER GASTRIC 500 MG TAB', 'METFORMIN ER GASTRIC 500 MG TAB')).toBe(false);
  });

  it('finds the newest yearly NADAC dataset', () => {
    const found = nadacDatasets([
      { identifier: 'a', title: 'NADAC (National Average Drug Acquisition Cost) 2025' },
      { identifier: 'b', title: 'NADAC (National Average Drug Acquisition Cost) 2026' },
      { identifier: 'c', title: 'NADAC Comparison 2026' },
      { identifier: 'd', title: 'State Drug Utilization Data 2026' },
    ]);
    expect(found.map((d) => d.id)).toEqual(['b', 'a']);
    expect(nadacDatasets({ not: 'an array' })).toEqual([]);
  });

  it('builds a valid feed, keeps old entries without new rows, and detects no-op runs', () => {
    const old: NadacFeed = {
      asOfDate: '2026-09-23',
      datasetId: 'x',
      entries: [
        {
          key: 'ELIQUIS 5 MG TABLET',
          ndcDescription: 'ELIQUIS 5 MG TABLET',
          ndc: '00003089421',
          perUnit: 9.8,
          pricingUnit: 'EA',
          effectiveDate: '2026-07-01',
        },
        {
          key: 'GONE',
          ndcDescription: 'GONE',
          ndc: '00000000009',
          perUnit: 1,
          pricingUnit: 'EA',
          effectiveDate: '2026-07-01',
        },
      ],
      sources: [
        { name: 'old', url: 'https://data.medicaid.gov/dataset/x', method: 'unconfirmed', checkedOn: '2026-09-01' },
      ],
      verifiedAsOf: '2026-09-01',
    };
    const { rows } = parseRows([row('00000000001', '0.03', '2026-09-30')]);
    const summaries = new Map([
      ['METFORMIN HCL ER 500 MG TABLET', summarizeKey('METFORMIN HCL ER 500 MG TABLET', rows)],
      ['ELIQUIS 5 MG TABLET', null],
      ['NEVER SEEN', null],
    ]);
    const args = {
      keys: ['METFORMIN HCL ER 500 MG TABLET', 'ELIQUIS 5 MG TABLET', 'NEVER SEEN'],
      summaries,
      dataset: { id: 'y', title: 'NADAC (National Average Drug Acquisition Cost) 2026' },
      apiUrl: 'https://data.medicaid.gov/api/1/datastore/query/y/0',
      today: '2026-10-06',
    };
    const u = buildFeed({ old, ...args });
    expect(u.changed).toBe(true);
    expect(u.updated).toEqual(['METFORMIN HCL ER 500 MG TABLET']);
    expect(u.kept).toEqual(['ELIQUIS 5 MG TABLET']);
    expect(u.skipped).toEqual(['NEVER SEEN']);
    expect(u.dropped).toEqual(['GONE']);
    expect(u.feed.asOfDate).toBe('2026-09-30');
    expect(u.feed.sources[0]).toMatchObject({
      method: 'official-api',
      checkedOn: '2026-10-06',
      url: 'https://data.medicaid.gov/dataset/y',
    });
    expect(nadacFeedSchema.safeParse(u.feed).success).toBe(true);

    expect(buildFeed({ old: u.feed, ...args }).changed).toBe(false);
  });
});
