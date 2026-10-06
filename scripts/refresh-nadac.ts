/**
 * Weekly NADAC refresh from the CMS datastore on data.medicaid.gov.
 *
 *   npx tsx scripts/refresh-nadac.ts [--dry-run] [--pack <id>] [--packs-dir <dir>] [--dataset-id <id>]
 *
 * 1. Keys: every strengths[].nadacKey in the pack's medications.json — each is the exact NADAC
 *    `ndc_description` (e.g. "METFORMIN HCL ER 500 MG TABLET").
 * 2. Dataset: the newest "NADAC (National Average Drug Acquisition Cost) <year>" in the DKAN
 *    metastore (/api/1/metastore/schemas/dataset/items?show-reference-ids); if that yields
 *    nothing, the previous year's, then the datasetId already in nadac.json.
 * 3. Rows: /api/1/datastore/query/<id>/0 with ndc_description = key, newest as_of_date first,
 *    500 rows per page (the DKAN cap), paging with offset until the newest weekly file is complete.
 * 4. Per key: rows from the newest weekly file, one per NDC; perUnit is the median across NDCs and
 *    ndc the NDC closest to it (see scripts/lib/nadac.ts). Osmotic/gastric-retentive rows are
 *    skipped unless the key names them. Keys with no rows keep their previous entry, if any.
 * 5. Writes prices/nadac.json (asOfDate = newest as_of_date, method official-api, checked today)
 *    only when the data changed and the result passes nadacFeedSchema. All packs are computed
 *    before any file is written, so a failure never leaves partial data.
 *
 * Network trouble (offline, timeouts, 5xx, a proxy refusing the host) → message, exit 0, nothing
 * written: the weekly job just skips. Unexpected answers or invalid results → exit 1.
 * NADAC_API_BASE overrides https://data.medicaid.gov (tests use a local mock).
 */
import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { medicationsSchema, nadacFeedSchema } from '../src/data/schemas';

import { color, errorMessage, parseArgs, readJsonFile, rel, run, table, todayLocal } from './lib/cli';
import { formatJson, writeFileAtomic } from './lib/format';
import { fetchJson, HttpError, NetworkError } from './lib/http';
import {
  buildFeed,
  nadacDatasets,
  nadacFeedWithNotes,
  parseRows,
  summarizeKey,
  type DatasetRef,
  type FeedUpdate,
  type KeySummary,
  type NadacFeed,
  type NadacRow,
} from './lib/nadac';
import { formatZodIssues, listPackIds, parseWith, resolvePacksDir } from './lib/packs';

const API_BASE = (process.env.NADAC_API_BASE ?? 'https://data.medicaid.gov').replace(/\/+$/, '');
const PAGE_SIZE = 500; // DKAN's maximum; never 0 (= no limit)
const MAX_PAGES = 40;
const FEED_FILE = 'prices/nadac.json';

const queryResponse = z.object({
  results: z.array(z.unknown()),
  count: z.union([z.number(), z.string()]).optional(),
});

const queryUrl = (datasetId: string) => `${API_BASE}/api/1/datastore/query/${encodeURIComponent(datasetId)}/0`;

/** All rows for one ndc_description from the newest weekly file (pages until it is complete). */
async function fetchKeyRows(datasetId: string, key: string): Promise<{ rows: NadacRow[]; rejected: number }> {
  const rows: NadacRow[] = [];
  let rejected = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      'conditions[0][property]': 'ndc_description',
      'conditions[0][value]': key,
      'conditions[0][operator]': '=',
      'sorts[0][property]': 'as_of_date',
      'sorts[0][order]': 'desc',
      'sorts[1][property]': 'effective_date',
      'sorts[1][order]': 'desc',
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    const json = await fetchJson(`${queryUrl(datasetId)}?${params}`);
    const parsed = queryResponse.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        `unexpected datastore response for dataset ${datasetId}: ${formatZodIssues(parsed.error).join('; ')}`,
        200,
      );
    }
    const { results, count } = parsed.data;
    const pageRows = parseRows(results);
    rejected += pageRows.rejected;
    rows.push(...pageRows.rows);

    const total = count === undefined ? undefined : Number(count);
    if (results.length < PAGE_SIZE) break;
    if (total !== undefined && Number.isFinite(total) && (page + 1) * PAGE_SIZE >= total) break;
    // Sorted newest as_of_date first: once a page reaches an older weekly file, we have the newest one complete.
    const newest = rows[0]?.asOfDate;
    const lastOnPage = pageRows.rows[pageRows.rows.length - 1];
    if (newest && lastOnPage && lastOnPage.asOfDate < newest) break;
  }
  return { rows, rejected };
}

async function candidateDatasets(override: string | undefined, fromFiles: readonly string[]): Promise<DatasetRef[]> {
  if (override) return [{ id: override, title: '', year: 0 }];
  const out: DatasetRef[] = [];
  const url = `${API_BASE}/api/1/metastore/schemas/dataset/items?show-reference-ids`;
  try {
    const found = nadacDatasets(await fetchJson(url, { timeoutMs: 60_000 }));
    if (found.length) {
      console.log(
        `Datasets: ${found
          .slice(0, 3)
          .map((d) => `${d.title} (${d.id})`)
          .join(', ')}`,
      );
      out.push(...found.slice(0, 2));
    } else {
      console.log(
        color.yellow(
          'warn  no "NADAC (National Average Drug Acquisition Cost) <year>" dataset in the metastore listing',
        ),
      );
    }
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    console.log(
      color.yellow(`warn  dataset search failed (${errorMessage(e)}); falling back to the datasetId in nadac.json`),
    );
  }
  for (const id of fromFiles) if (!out.some((d) => d.id === id)) out.push({ id, title: '', year: 0 });
  return out;
}

type PackPlan = {
  pack: string;
  file: string;
  update: FeedUpdate;
  summaries: Map<string, KeySummary | null>;
};

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), ['pack', 'packs-dir', 'dataset-id']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const only = args.value('pack');
  const dryRun = args.has('dry-run');
  const today = todayLocal();

  const packs = listPackIds(packsDir).filter(
    (p) => (!only || p === only) && fs.existsSync(path.join(packsDir, p, FEED_FILE)),
  );
  if (!packs.length) {
    console.log(`No NADAC feed files found (looked for ${rel(packsDir)}/*/${FEED_FILE}) — nothing to refresh.`);
    return 0;
  }

  // Load and check inputs first.
  const inputs: { pack: string; file: string; keys: string[]; old: NadacFeed }[] = [];
  for (const pack of packs) {
    const file = path.join(packsDir, pack, FEED_FILE);
    const medsRead = readJsonFile(path.join(packsDir, pack, 'medications.json'));
    const feedRead = readJsonFile(file);
    if (!medsRead.ok || !feedRead.ok) {
      console.error(color.red(`✖ ${pack}: ${!medsRead.ok ? medsRead.error : feedRead.ok ? '' : feedRead.error}`));
      return 1;
    }
    const meds = parseWith(medicationsSchema, medsRead.json);
    const old = parseWith(nadacFeedWithNotes, feedRead.json);
    if (!meds || !old) {
      console.error(
        color.red(
          `✖ ${pack}: ${!meds ? 'medications.json' : FEED_FILE} does not pass its schema — run npm run check:packs first.`,
        ),
      );
      return 1;
    }
    const keys = [
      ...new Set(meds.medications.flatMap((m) => m.strengths.map((s) => s.nadacKey)).filter((k): k is string => !!k)),
    ];
    inputs.push({ pack, file, keys, old });
  }

  const allKeys = [...new Set(inputs.flatMap((i) => i.keys))];
  if (!allKeys.length) {
    console.log('No strength has a nadacKey — nothing to refresh.');
    return 0;
  }
  console.log(color.bold(`NADAC refresh — ${allKeys.length} key(s) from ${API_BASE}`));

  const fileIds = inputs.map((i) => i.old.datasetId).filter((id): id is string => !!id);
  const candidates = await candidateDatasets(args.value('dataset-id') ?? process.env.NADAC_DATASET_ID, fileIds);
  if (!candidates.length) {
    console.error(
      color.red('✖ No NADAC dataset to query: none found in the metastore and nadac.json has no datasetId.'),
    );
    return 1;
  }

  // Pick the first dataset that has rows for at least one key.
  let chosen: DatasetRef | null = null;
  let summaries = new Map<string, KeySummary | null>();
  for (const ds of candidates) {
    const found = new Map<string, KeySummary | null>();
    try {
      for (const key of allKeys) {
        const { rows, rejected } = await fetchKeyRows(ds.id, key);
        if (rejected) console.log(color.yellow(`warn  ${rejected} row(s) for "${key}" were malformed and ignored`));
        found.set(key, summarizeKey(key, rows));
      }
    } catch (e) {
      if (e instanceof NetworkError) throw e;
      console.log(color.yellow(`warn  dataset ${ds.id}: ${errorMessage(e)} — trying the next one`));
      continue;
    }
    if ([...found.values()].some(Boolean)) {
      chosen = ds;
      summaries = found;
      break;
    }
    console.log(color.yellow(`warn  dataset ${ds.title || ds.id} has no rows for any key — trying the next one`));
  }
  if (!chosen) {
    console.error(
      color.red(
        `✖ No NADAC rows matched any nadacKey in ${candidates.map((c) => c.id).join(', ')}. ` +
          'Check that each nadacKey is the exact NADAC ndc_description.',
      ),
    );
    return 1;
  }

  // Build every pack's new feed before writing anything.
  const plans: PackPlan[] = [];
  for (const input of inputs) {
    const update = buildFeed({
      old: input.old,
      keys: input.keys,
      summaries,
      dataset: { id: chosen.id, title: chosen.title || undefined },
      apiUrl: queryUrl(chosen.id),
      today,
    });
    const check = nadacFeedSchema.safeParse(update.feed);
    if (!check.success) {
      console.error(color.red(`✖ ${input.pack}: the refreshed feed fails nadacFeedSchema — nothing written:`));
      for (const line of formatZodIssues(check.error)) console.error(color.red(`    ${line}`));
      return 1;
    }
    plans.push({ pack: input.pack, file: input.file, update, summaries });
  }

  for (const plan of plans) {
    const { update } = plan;
    console.log('');
    console.log(
      color.bold(`${plan.pack}: ${rel(plan.file)}`) +
        color.dim(` — dataset ${chosen.title || chosen.id}, as of ${update.feed.asOfDate ?? '—'}`),
    );
    const rows = update.feed.entries.map((e) => [
      e.key,
      String(plan.summaries.get(e.key)?.ndcCount ?? '—'),
      `$${e.perUnit}`,
      e.pricingUnit,
      e.effectiveDate,
      e.ndc,
      update.updated.includes(e.key) ? color.green('updated') : color.yellow('kept (no rows this week)'),
    ]);
    if (rows.length) console.log(table(['Key', 'NDCs', 'Per unit', 'Unit', 'Effective', 'NDC', ''], rows));
    for (const k of update.skipped)
      console.log(color.yellow(`warn  no NADAC rows for "${k}" — skipped (the app shows "Not listed")`));
    for (const k of update.dropped) console.log(color.dim(`note  dropped "${k}" — no strength uses it any more`));
  }

  console.log('');
  for (const plan of plans) {
    if (!plan.update.changed) {
      console.log(
        color.green(`✔ ${plan.pack}: already current (as of ${plan.update.feed.asOfDate ?? '—'}) — not rewritten.`),
      );
    } else if (dryRun) {
      console.log(color.cyan(`• ${plan.pack}: would update ${rel(plan.file)} (--dry-run, nothing written).`));
    } else {
      writeFileAtomic(plan.file, await formatJson(plan.update.feed, plan.file));
      console.log(color.green(`✔ ${plan.pack}: wrote ${rel(plan.file)}. Next: npm run pack:manifest`));
    }
  }
  return 0;
}

run(async () => {
  try {
    return await main();
  } catch (e) {
    if (e instanceof NetworkError) {
      console.log(color.yellow(`⚠ Skipping the NADAC refresh: ${e.message}. Nothing was written.`));
      return 0;
    }
    throw e;
  }
});
