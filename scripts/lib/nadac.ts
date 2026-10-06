/**
 * Pure logic for the weekly NADAC refresh (scripts/refresh-nadac.ts): parse DKAN datastore
 * rows, pick the current dataset, and turn rows into nadac.json entries. No network here.
 *
 * Each medication strength's `nadacKey` is the exact NADAC `ndc_description`
 * (e.g. "METFORMIN HCL ER 500 MG TABLET"). Many NDCs can share one description; we use the
 * rows from the newest weekly file (`as_of_date`), one per NDC, and publish the median
 * per-unit price, recording the NDC whose price is closest to that median.
 */
import { z } from 'zod';

import { nadacEntrySchema, nadacFeedSchema, pricingUnit } from '../../src/data/schemas';

import { isRealDate } from './cli';

/** "2026-09-30", "2026-09-30T00:00:00", "09/30/2026" → "2026-09-30"; anything else → null. */
export function toIsoDate(value: string): string | null {
  const s = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const out = iso
    ? `${iso[1]}-${iso[2]}-${iso[3]}`
    : us
      ? `${us[3]}-${(us[1] ?? '').padStart(2, '0')}-${(us[2] ?? '').padStart(2, '0')}`
      : null;
  return out && isRealDate(out) ? out : null;
}

/**
 * nadac.json as this script writes it: entries may carry a `note` (e.g. how a median was
 * taken). The app's schema ignores unknown keys, so the note is informational.
 */
export const nadacEntryWithNote = nadacEntrySchema.extend({ note: z.string().optional() });
export const nadacFeedWithNotes = nadacFeedSchema.extend({ entries: z.array(nadacEntryWithNote) });
export type NadacEntry = z.infer<typeof nadacEntryWithNote>;
export type NadacFeed = z.infer<typeof nadacFeedWithNotes>;

export const normalizeDescription = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

const text = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

/** One row of the NADAC datastore, as DKAN returns it (every value a string). */
const rawRowSchema = z.object({
  ndc_description: text,
  ndc: text,
  nadac_per_unit: text,
  effective_date: text,
  pricing_unit: text,
  as_of_date: text,
  classification_for_rate_setting: text.nullish(),
});

export type NadacRow = {
  description: string;
  ndc: string;
  perUnit: number;
  pricingUnit: NadacEntry['pricingUnit'];
  effectiveDate: string;
  asOfDate: string;
  classification?: string;
};

/** Validates raw rows; rows that don't fit (bad number, unknown unit, bad date) are counted, not used. */
export function parseRows(results: readonly unknown[]): { rows: NadacRow[]; rejected: number } {
  const rows: NadacRow[] = [];
  let rejected = 0;
  for (const r of results) {
    const p = rawRowSchema.safeParse(r);
    const unit = p.success ? pricingUnit.safeParse(p.data.pricing_unit.toUpperCase()) : null;
    const perUnit = p.success ? Number(p.data.nadac_per_unit) : NaN;
    const eff = p.success ? toIsoDate(p.data.effective_date) : null;
    const asOf = p.success ? toIsoDate(p.data.as_of_date) : null;
    const ndc = p.success ? p.data.ndc.replace(/\D/g, '') : '';
    if (
      !p.success ||
      !unit?.success ||
      !Number.isFinite(perUnit) ||
      perUnit < 0 ||
      !eff ||
      !asOf ||
      ndc.length !== 11
    ) {
      rejected++;
      continue;
    }
    const classification = p.data.classification_for_rate_setting?.trim();
    rows.push({
      description: p.data.ndc_description.trim().replace(/\s+/g, ' '),
      ndc,
      perUnit,
      pricingUnit: unit.data,
      effectiveDate: eff,
      asOfDate: asOf,
      ...(classification ? { classification } : {}),
    });
  }
  return { rows, rejected };
}

/** Osmotic and gastric-retentive ER tablets are different products; skip them unless the key asks for them. */
export function isExcludedForKey(key: string, description: string): boolean {
  const k = normalizeDescription(key);
  const d = normalizeDescription(description);
  return [/\bOSM/, /\bGASTR/].some((re) => re.test(d) && !re.test(k));
}

export type KeySummary = { entry: NadacEntry; asOfDate: string; ndcCount: number };

const round5 = (n: number) => Math.round(n * 100_000) / 100_000;

/**
 * Turns all rows fetched for one key into its nadac.json entry, or null when none match.
 * Uses only the newest weekly file (max as_of_date), newest effective_date per NDC.
 */
export function summarizeKey(key: string, rows: readonly NadacRow[]): KeySummary | null {
  const want = normalizeDescription(key);
  const matching = rows.filter(
    (r) => normalizeDescription(r.description) === want && !isExcludedForKey(key, r.description),
  );
  if (!matching.length) return null;

  const latestAsOf = matching.reduce((m, r) => (r.asOfDate > m ? r.asOfDate : m), '');
  const perNdc = new Map<string, NadacRow>();
  for (const r of matching) {
    if (r.asOfDate !== latestAsOf) continue;
    const prev = perNdc.get(r.ndc);
    if (!prev || r.effectiveDate > prev.effectiveDate) perNdc.set(r.ndc, r);
  }
  let current = [...perNdc.values()];

  // All entries of one description should share a pricing unit; keep the most common if not.
  const units = new Map<string, number>();
  for (const r of current) units.set(r.pricingUnit, (units.get(r.pricingUnit) ?? 0) + 1);
  const unit = [...units].sort((a, b) => b[1] - a[1])[0]?.[0];
  current = current.filter((r) => r.pricingUnit === unit);

  const sorted = [...current].sort((a, b) => a.perUnit - b.perUnit || a.ndc.localeCompare(b.ndc));
  const n = sorted.length;
  const lo = sorted[Math.floor((n - 1) / 2)];
  const hi = sorted[Math.floor(n / 2)];
  if (!lo || !hi) return null;
  const median = round5((lo.perUnit + hi.perUnit) / 2);
  const rep = [...sorted].sort(
    (a, b) => Math.abs(a.perUnit - median) - Math.abs(b.perUnit - median) || a.ndc.localeCompare(b.ndc),
  )[0];
  if (!rep) return null;

  const first = sorted[0];
  const last = sorted[n - 1];
  const note =
    n > 1 && first && last
      ? `Median of ${n} NDCs in the NADAC file as of ${latestAsOf}` +
        (first.perUnit !== last.perUnit ? ` (range ${first.perUnit}–${last.perUnit} per ${rep.pricingUnit})` : '') +
        `; ndc is the NDC closest to the median.`
      : undefined;

  return {
    entry: {
      key,
      ndcDescription: rep.description,
      ndc: rep.ndc,
      perUnit: n > 1 ? median : rep.perUnit,
      pricingUnit: rep.pricingUnit,
      effectiveDate: rep.effectiveDate,
      ...(rep.classification ? { classification: rep.classification } : {}),
      ...(note ? { note } : {}),
    },
    asOfDate: latestAsOf,
    ndcCount: n,
  };
}

// ---------------------------------------------------------------- dataset discovery

const NADAC_TITLE = /^\s*NADAC\s*\(\s*National Average Drug Acquisition Cost\s*\)\s*(\d{4})\s*$/i;

export type DatasetRef = { id: string; title: string; year: number; modified?: string };

/** NADAC yearly datasets from a DKAN metastore listing, newest year first. */
export function nadacDatasets(items: unknown): DatasetRef[] {
  const parsed = z
    .array(z.object({ identifier: z.string(), title: z.string(), modified: z.string().optional() }))
    .safeParse(items);
  if (!parsed.success) return [];
  return parsed.data
    .flatMap((d) => {
      const m = NADAC_TITLE.exec(d.title);
      return m?.[1] ? [{ id: d.identifier, title: d.title.trim(), year: Number(m[1]), modified: d.modified }] : [];
    })
    .sort((a, b) => b.year - a.year || (b.modified ?? '').localeCompare(a.modified ?? ''));
}

// ---------------------------------------------------------------- feed update

export type FeedUpdate = {
  feed: NadacFeed;
  changed: boolean;
  updated: string[];
  kept: string[];
  skipped: string[];
  dropped: string[];
};

/**
 * Builds the new feed. Keys with fresh rows get new entries; keys without keep their previous
 * entry if any (logged), otherwise are skipped; entries no strength uses any more are dropped.
 * `changed` compares only data (asOfDate, datasetId, entries), not check dates.
 */
export function buildFeed(args: {
  old: NadacFeed;
  keys: readonly string[];
  summaries: ReadonlyMap<string, KeySummary | null>;
  dataset: { id: string; title?: string };
  apiUrl: string;
  today: string;
}): FeedUpdate {
  const { old, keys, summaries, dataset, apiUrl, today } = args;
  const oldByKey = new Map(old.entries.map((e) => [e.key, e]));
  const entries: NadacFeed['entries'] = [];
  const updated: string[] = [];
  const kept: string[] = [];
  const skipped: string[] = [];
  let asOfDate: string | null = null;

  for (const key of keys) {
    const s = summaries.get(key);
    if (s) {
      entries.push(s.entry);
      updated.push(key);
      if (asOfDate === null || s.asOfDate > asOfDate) asOfDate = s.asOfDate;
      continue;
    }
    const prev = oldByKey.get(key);
    if (prev) {
      entries.push(prev);
      kept.push(key);
    } else {
      skipped.push(key);
    }
  }
  const dropped = old.entries.filter((e) => !keys.includes(e.key)).map((e) => e.key);
  if (asOfDate === null) asOfDate = old.asOfDate;

  const [first, ...rest] = old.sources;
  const source = {
    ...(first ?? {}),
    name: dataset.title ? `data.medicaid.gov — ${dataset.title}` : (first?.name ?? 'data.medicaid.gov — NADAC'),
    url: `https://data.medicaid.gov/dataset/${dataset.id}`,
    method: 'official-api' as const,
    checkedOn: today,
    ...(dataset.title ? { edition: dataset.title } : {}),
    note: `Weekly refresh by scripts/refresh-nadac.ts from the datastore API (${apiUrl}). When several NDCs share a description, perUnit is their median.`,
  };

  const feed: NadacFeed = {
    ...old,
    asOfDate,
    datasetId: dataset.id,
    entries,
    sources: [source, ...rest],
    verifiedAsOf: today,
  };
  const data = (f: NadacFeed) => JSON.stringify({ a: f.asOfDate, d: f.datasetId, e: f.entries });
  return { feed, changed: data(feed) !== data(old), updated, kept, skipped, dropped };
}
