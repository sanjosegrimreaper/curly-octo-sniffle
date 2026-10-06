/**
 * Validates every data pack in data/packs/<id>/.
 *
 *   npx tsx scripts/validate-packs.ts [--release] [--pack <id>] [--packs-dir <dir>]
 *
 * Checks
 *  - every file in PACK_FILES (src/data/pack.ts) exists, is JSON and passes its Zod schema;
 *  - Honesty Contract: every object with `sources` has >= 1 source and a real `verifiedAsOf`
 *    that is not in the future; every `checkedOn` is a real date, not in the future;
 *  - every URL is https; every YYYY-MM-DD string is a real date;
 *  - cross-references (programIds, medicationIds, outlook, Cost Plus quotes, nadacKey, direct prices);
 *  - duplicate ids inside a list;
 *  - manifest.json checksums match the files (every JSON file in the pack folder except the manifest);
 *  - unconfirmed facts (a source method outside CONFIRMED_METHODS): counted and warned in a
 *    'draft' pack, an error in a 'release' pack or with --release;
 *  - localized text missing a launch language: warning only.
 *
 * Exit code 1 on any error.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  costPlusSnapshotSchema,
  directPricesSchema,
  manifestSchema,
  medicationsSchema,
  nadacFeedSchema,
  outlooksSchema,
  programsSchema,
} from '../src/data/schemas';

import { color, isRealDate, parseArgs, readJsonFile, rel, run, table, todayLocal } from './lib/cli';
import {
  FILE_SCHEMAS,
  formatPath,
  formatZodIssues,
  isConfirmedMethod,
  isLocalized,
  isPlainObject,
  LAUNCH_LANGUAGES,
  lastKey,
  listPackIds,
  listPackJsonFiles,
  manifestCoveredFiles,
  packFilesFor,
  parseWith,
  readPackRegistry,
  resolvePacksDir,
  sha256File,
  UNVERIFIED_FILE,
  unverifiedSchema,
  walk,
} from './lib/packs';

type Level = 'error' | 'warn';
type Issue = { level: Level; pack: string; file: string; message: string };
type FileStatus = 'ok' | 'invalid' | 'missing';
type FileRow = {
  pack: string;
  file: string;
  status: FileStatus;
  optional: boolean;
  records: number;
  /** Facts whose sources are all unconfirmed. */
  unconfirmed: number;
};
type ContentResult = {
  records: number;
  /** Records with no confirmed source (the app labels them "Not yet confirmed"). */
  unconfirmedFacts: string[];
  /** Every source whose method is outside CONFIRMED_METHODS. */
  unconfirmedSources: string[];
};

/** Date fields that must not be in the future. */
const NO_FUTURE_KEYS = new Set(['verifiedAsOf', 'checkedOn', 'generatedAt', 'asOfDate', 'snapshotDate', 'lastTried']);
const URL_LIKE = /^[a-z][a-z0-9+.-]*:\/\//i;
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXAMPLES = 4;

class Issues {
  readonly list: Issue[] = [];
  error(pack: string, file: string, message: string) {
    this.list.push({ level: 'error', pack, file, message });
  }
  warn(pack: string, file: string, message: string) {
    this.list.push({ level: 'warn', pack, file, message });
  }
  count(level: Level, pack: string, file?: string) {
    return this.list.filter((i) => i.level === level && i.pack === pack && (file === undefined || i.file === file))
      .length;
  }
}

function examples(paths: readonly string[]): string {
  const shown = paths.slice(0, MAX_EXAMPLES).join(', ');
  return paths.length > MAX_EXAMPLES ? `${shown}, …` : shown;
}

/** Honesty, URL, date, duplicate-id and translation checks on one parsed file. */
function contentChecks(
  pack: string,
  file: string,
  json: unknown,
  today: string,
  issues: Issues,
): ContentResult {
  let records = 0;
  const unconfirmedFacts: string[] = [];
  const unconfirmedSources: string[] = [];
  const missingLang = new Map<string, string[]>();

  walk(json, (value, at) => {
    const p = formatPath(at);

    if (isPlainObject(value) && 'sources' in value) {
      records++;
      const srcs = value.sources;
      const prefix = at.length ? `${p}.` : '';
      if (!Array.isArray(srcs) || srcs.length === 0) {
        issues.error(pack, file, `${p}: has "sources" but no source — every fact needs at least one`);
      } else {
        let confirmed = 0;
        srcs.forEach((s, i) => {
          if (!isPlainObject(s)) return;
          if (typeof s.checkedOn !== 'string') issues.error(pack, file, `${prefix}sources[${i}]: missing checkedOn`);
          if (isConfirmedMethod(s.method)) confirmed++;
          else unconfirmedSources.push(`${prefix}sources[${i}] (${String(s.method)})`);
        });
        if (confirmed === 0) unconfirmedFacts.push(p);
      }
      if (typeof value.verifiedAsOf !== 'string') {
        issues.error(pack, file, `${p}: has "sources" but no verifiedAsOf date`);
      }
    }

    if (Array.isArray(value)) {
      const seen = new Map<string, number>();
      for (const item of value) {
        if (!isPlainObject(item)) continue;
        const id = typeof item.id === 'string' ? item.id : typeof item.key === 'string' ? item.key : undefined;
        if (id !== undefined) seen.set(id, (seen.get(id) ?? 0) + 1);
      }
      for (const [id, n] of seen) if (n > 1) issues.error(pack, file, `${p}: id "${id}" is used ${n} times`);
    }

    if (isLocalized(value)) {
      for (const lang of LAUNCH_LANGUAGES) {
        const text = value[lang];
        if (text === undefined || text.trim() === '') {
          const list = missingLang.get(lang) ?? [];
          list.push(p);
          missingLang.set(lang, list);
        }
      }
    }

    if (typeof value === 'string') {
      const key = lastKey(at) ?? '';
      if (URL_LIKE.test(value) || (/url$/i.test(key) && value !== '')) {
        if (!value.startsWith('https://')) issues.error(pack, file, `${p}: URL must use https — "${value}"`);
        else if (!URL.canParse(value)) issues.error(pack, file, `${p}: not a valid URL — "${value}"`);
      }
      if (ISO_LIKE.test(value)) {
        if (!isRealDate(value)) issues.error(pack, file, `${p}: "${value}" is not a real calendar date`);
        else if (NO_FUTURE_KEYS.has(key) && value > today) {
          issues.error(pack, file, `${p}: ${key} ${value} is in the future (today is ${today})`);
        }
      }
    }
  });

  if (missingLang.size) {
    const counts = [...missingLang].map(([lang, paths]) => `${lang} ${paths.length}`).join(', ');
    const all = [...new Set([...missingLang.values()].flat())];
    issues.warn(
      pack,
      file,
      `untranslated localized text (shown in English with a "not translated" note) — missing ${counts}: ${examples(all)}`,
    );
  }
  return { records, unconfirmedFacts, unconfirmedSources };
}

/** Cross-file references. Runs only on files that passed their schema. */
function crossRefChecks(pack: string, data: ReadonlyMap<string, unknown>, issues: Issues) {
  const meds = parseWith(medicationsSchema, data.get('medications.json'))?.medications;
  const programs = parseWith(programsSchema, data.get('programs.json'))?.programs;
  const outlooks = parseWith(outlooksSchema, data.get('outlook.json'))?.outlooks;
  const costPlus = parseWith(costPlusSnapshotSchema, data.get('prices/costplus.json'));
  const nadac = parseWith(nadacFeedSchema, data.get('prices/nadac.json'));
  const direct = parseWith(directPricesSchema, data.get('prices/direct.json'))?.prices;

  if (!meds) return;
  const strengthsOf = new Map(meds.map((m) => [m.id, new Set(m.strengths.map((s) => s.id))]));
  const medExists = (id: string) => strengthsOf.has(id);
  const strengthExists = (medId: string, strengthId: string) => strengthsOf.get(medId)?.has(strengthId) ?? false;

  if (programs) {
    const programIds = new Set(programs.map((p) => p.id));
    for (const m of meds) {
      for (const pid of m.programIds) {
        if (!programIds.has(pid)) {
          issues.error(pack, 'medications.json', `medications[${m.id}].programIds: "${pid}" is not in programs.json`);
        }
      }
    }
    for (const p of programs) {
      for (const mid of p.medicationIds) {
        if (!medExists(mid)) {
          issues.error(pack, 'programs.json', `programs[${p.id}].medicationIds: "${mid}" is not in medications.json`);
        } else if (!meds.find((m) => m.id === mid)?.programIds.includes(p.id)) {
          issues.warn(
            pack,
            'programs.json',
            `programs[${p.id}] lists "${mid}", but medications[${mid}].programIds does not list "${p.id}"`,
          );
        }
      }
    }
  }

  for (const [i, o] of (outlooks ?? []).entries()) {
    if (!medExists(o.medicationId)) {
      issues.error(pack, 'outlook.json', `outlooks[${i}].medicationId: "${o.medicationId}" is not in medications.json`);
    }
  }

  if (costPlus) {
    costPlus.quotes.forEach((q, i) => {
      if (!medExists(q.medicationId)) {
        issues.error(pack, 'prices/costplus.json', `quotes[${i}].medicationId: "${q.medicationId}" is not a medication`);
      } else if (!strengthExists(q.medicationId, q.strengthId)) {
        issues.error(
          pack,
          'prices/costplus.json',
          `quotes[${i}].strengthId: "${q.strengthId}" is not a strength of ${q.medicationId}`,
        );
      }
    });
    costPlus.notListed.forEach((n, i) => {
      if (!medExists(n.medicationId)) {
        issues.error(pack, 'prices/costplus.json', `notListed[${i}].medicationId: "${n.medicationId}" is not a medication`);
      } else if (n.strengthId !== null && !strengthExists(n.medicationId, n.strengthId)) {
        issues.error(
          pack,
          'prices/costplus.json',
          `notListed[${i}].strengthId: "${n.strengthId}" is not a strength of ${n.medicationId}`,
        );
      }
    });
  }

  for (const d of direct ?? []) {
    if (!medExists(d.medicationId)) {
      issues.error(pack, 'prices/direct.json', `prices[${d.id}].medicationId: "${d.medicationId}" is not a medication`);
      continue;
    }
    for (const sid of d.strengthIds) {
      if (!strengthExists(d.medicationId, sid)) {
        issues.error(pack, 'prices/direct.json', `prices[${d.id}].strengthIds: "${sid}" is not a strength of ${d.medicationId}`);
      }
    }
  }

  if (nadac) {
    // nadacKey is the exact NADAC ndc_description; the weekly refresh fills the entries.
    const entryKeys = new Set(nadac.entries.map((e) => e.key));
    const used = new Set<string>();
    const pending: string[] = [];
    for (const m of meds) {
      for (const s of m.strengths) {
        if (s.nadacKey === null) continue;
        used.add(s.nadacKey);
        if (!entryKeys.has(s.nadacKey)) pending.push(`medications[${m.id}].strengths[${s.id}] "${s.nadacKey}"`);
      }
    }
    if (pending.length) {
      issues.warn(
        pack,
        'prices/nadac.json',
        `${pending.length} nadacKey(s) have no NADAC entry ${nadac.asOfDate === null ? '(feed not loaded yet)' : `in the ${nadac.asOfDate} feed`} — ` +
          `the app shows "Not listed" until the weekly refresh finds them; check each key is the exact NADAC ndc_description: ${examples(pending)}`,
      );
    }
    for (const k of entryKeys) {
      if (!used.has(k)) issues.warn(pack, 'prices/nadac.json', `entry "${k}" is not used by any strength's nadacKey`);
    }
  }
}

function manifestChecks(pack: string, packDir: string, json: unknown, issues: Issues) {
  const manifest = parseWith(manifestSchema, json);
  if (!manifest) return;
  if (manifest.packId !== pack) {
    issues.error(pack, 'manifest.json', `packId is "${manifest.packId}" but the folder is "${pack}"`);
  }
  let stale = false;
  const expected = manifestCoveredFiles(packDir);
  for (const f of expected) {
    const full = path.join(packDir, f);
    const listed = manifest.files[f];
    if (listed === undefined) {
      issues.error(pack, 'manifest.json', `no checksum for ${f}`);
      stale = true;
    } else if (listed !== sha256File(full)) {
      issues.error(pack, 'manifest.json', `checksum mismatch for ${f} (the file changed since the manifest was built)`);
      stale = true;
    }
  }
  for (const f of Object.keys(manifest.files)) {
    if (!expected.includes(f)) {
      issues.error(pack, 'manifest.json', `lists "${f}", which does not exist in the pack folder`);
      stale = true;
    }
  }
  if (stale) issues.error(pack, 'manifest.json', 'hint: run `npm run pack:manifest` to recompute the checksums');
}

function validateOptional(
  pack: string,
  packDir: string,
  file: string,
  schema: { safeParse: (d: unknown) => { success: true } | { success: false; error: import('zod').ZodError } },
  today: string,
  issues: Issues,
  rows: FileRow[],
  data: Map<string, unknown>,
) {
  const full = path.join(packDir, file);
  if (!fs.existsSync(full)) return;
  const read = readJsonFile(full);
  if (!read.ok) {
    issues.error(pack, file, read.error);
    rows.push({ pack, file, status: 'invalid', optional: true, records: 0, unconfirmed: 0 });
    return;
  }
  const r = schema.safeParse(read.json);
  if (!r.success) for (const line of formatZodIssues(r.error)) issues.error(pack, file, `schema: ${line}`);
  const { records, unconfirmedFacts } = contentChecks(pack, file, read.json, today, issues);
  data.set(file, read.json);
  rows.push({ pack, file, status: r.success ? 'ok' : 'invalid', optional: true, records, unconfirmed: unconfirmedFacts.length });
}

type PackResult = {
  rows: FileRow[];
  unconfirmedByFile: Map<string, ContentResult>;
  releaseMode: boolean;
  status: string;
};

function validatePack(
  pack: string,
  packDir: string,
  files: readonly string[],
  forceRelease: boolean,
  today: string,
  issues: Issues,
): PackResult {
  const rows: FileRow[] = [];
  const data = new Map<string, unknown>();
  const unconfirmedByFile = new Map<string, ContentResult>();

  for (const file of files) {
    const full = path.join(packDir, file);
    const schema = FILE_SCHEMAS[file];
    if (!schema) {
      issues.error(pack, file, `no schema mapping for "${file}" — add it to FILE_SCHEMAS in scripts/lib/packs.ts`);
    }
    if (!fs.existsSync(full)) {
      issues.error(pack, file, `pack file missing: ${rel(full)}`);
      rows.push({ pack, file, status: 'missing', optional: false, records: 0, unconfirmed: 0 });
      continue;
    }
    const read = readJsonFile(full);
    if (!read.ok) {
      issues.error(pack, file, read.error);
      rows.push({ pack, file, status: 'invalid', optional: false, records: 0, unconfirmed: 0 });
      continue;
    }
    let valid = true;
    if (schema) {
      const r = schema.safeParse(read.json);
      if (!r.success) {
        valid = false;
        for (const line of formatZodIssues(r.error)) issues.error(pack, file, `schema: ${line}`);
      }
    }
    const content = contentChecks(pack, file, read.json, today, issues);
    if (content.unconfirmedSources.length) unconfirmedByFile.set(file, content);
    data.set(file, read.json);
    rows.push({
      pack,
      file,
      status: valid ? 'ok' : 'invalid',
      optional: false,
      records: content.records,
      unconfirmed: content.unconfirmedFacts.length,
    });
  }

  validateOptional(pack, packDir, UNVERIFIED_FILE, unverifiedSchema, today, issues, rows, data);

  // Stray JSON files the app never loads.
  const known = new Set([...files, UNVERIFIED_FILE]);
  for (const f of listPackJsonFiles(packDir)) {
    if (!known.has(f)) issues.warn(pack, f, 'not a pack file — the app does not load it (add it to PACK_FILES?)');
  }

  if (data.has('manifest.json')) manifestChecks(pack, packDir, data.get('manifest.json'), issues);
  crossRefChecks(pack, data, issues);

  const manifest = parseWith(manifestSchema, data.get('manifest.json'));
  const status = manifest?.status ?? 'unknown';
  const releaseMode = forceRelease || status === 'release';
  for (const [file, c] of unconfirmedByFile) {
    if (releaseMode) {
      issues.error(
        pack,
        file,
        `${c.unconfirmedSources.length} source(s) not confirmed on the official page — not allowed in a release pack; confirm or remove them (${examples(c.unconfirmedSources)})`,
      );
    } else {
      issues.warn(
        pack,
        file,
        `${c.unconfirmedFacts.length} of ${c.records} fact(s) not yet confirmed on the official page; ${c.unconfirmedSources.length} unconfirmed source(s) (${examples(c.unconfirmedSources)})`,
      );
    }
  }
  return { rows, unconfirmedByFile, releaseMode, status };
}

function printIssues(issues: Issues, pack: string) {
  const mine = issues.list.filter((i) => i.pack === pack);
  if (!mine.length) return;
  const byFile = new Map<string, Issue[]>();
  for (const i of mine) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
  for (const [file, list] of byFile) {
    console.log(color.bold(`  ${file}`));
    for (const i of list.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))) {
      const tag = i.level === 'error' ? color.red('error') : color.yellow('warn ');
      console.log(`    ${tag}  ${i.message}`);
    }
  }
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), ['pack', 'packs-dir']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const forceRelease = args.has('release');
  const today = todayLocal();
  const registry = readPackRegistry();
  const issues = new Issues();

  console.log(color.bold(`Validating data packs in ${rel(packsDir)}/ (today ${today}${forceRelease ? ', --release' : ''})`));

  let packIds = listPackIds(packsDir);
  const only = args.value('pack');
  if (only) packIds = packIds.filter((p) => p === only);

  if (!packIds.length) {
    const expected = registry ? [...registry.keys()].join(', ') : 'see docs/ARCHITECTURE.md';
    console.error(
      color.red(
        `✖ No data packs found: ${rel(packsDir)}/${only ? only + '/' : ''} does not exist or is empty (expected: ${expected}).`,
      ),
    );
    return 1;
  }

  if (registry && !only) {
    for (const id of registry.keys()) {
      if (!packIds.includes(id)) {
        issues.error(id, '(pack)', `registered in PACK_FILES (src/data/pack.ts) but ${rel(path.join(packsDir, id))}/ does not exist`);
      }
    }
  }

  const results = new Map<string, PackResult>();
  for (const pack of packIds) {
    if (registry && !registry.has(pack)) {
      issues.warn(pack, '(pack)', 'not registered in PACK_FILES (src/data/pack.ts) — the app will not load it');
    }
    results.set(pack, validatePack(pack, path.join(packsDir, pack), packFilesFor(pack, registry), forceRelease, today, issues));
  }

  const allPacks = [...new Set([...packIds, ...issues.list.map((i) => i.pack)])];
  for (const pack of allPacks) {
    const r = results.get(pack);
    console.log('');
    console.log(color.bold(`Pack ${pack}`) + (r ? color.dim(` (status: ${r.status})`) : ''));
    printIssues(issues, pack);
  }

  // Summary table
  const rows = [...results.values()].flatMap((r) => r.rows);
  console.log('');
  console.log(
    table(
      ['Pack', 'File', 'Status', 'Records', 'Unconfirmed', 'Errors', 'Warnings'],
      rows.map((row) => {
        const errs = issues.count('error', row.pack, row.file);
        const warns = issues.count('warn', row.pack, row.file);
        const status =
          row.status === 'missing'
            ? color.red('MISSING')
            : row.status === 'invalid' || errs > 0
              ? color.red('FAIL')
              : warns > 0
                ? color.yellow('ok*')
                : color.green('ok');
        return [
          row.pack,
          row.file + (row.optional ? color.dim(' (optional)') : ''),
          status,
          String(row.records),
          row.unconfirmed ? color.yellow(String(row.unconfirmed)) : '0',
          errs ? color.red(String(errs)) : '0',
          warns ? color.yellow(String(warns)) : '0',
        ];
      }),
    ),
  );

  // Prominent unconfirmed banner (draft packs)
  for (const [pack, r] of results) {
    const all = [...r.unconfirmedByFile.values()];
    const sourcesTotal = all.reduce((n, c) => n + c.unconfirmedSources.length, 0);
    if (!sourcesTotal) continue;
    const factsTotal = all.reduce((n, c) => n + c.unconfirmedFacts.length, 0);
    const recordsTotal = r.rows.reduce((n, row) => n + row.records, 0);
    const paint = r.releaseMode ? color.red : color.yellow;
    console.log('');
    console.log(paint('━'.repeat(72)));
    console.log(
      paint(
        color.bold(
          `${r.releaseMode ? '✖' : '⚠'}  ${pack}: ${factsTotal} of ${recordsTotal} facts NOT YET CONFIRMED on the official page` +
            (r.releaseMode ? ' — not allowed in a release pack' : ' (draft pack)'),
        ),
      ),
    );
    console.log(paint(`     ${'file'.padEnd(24)} ${'facts'.padStart(5)}  ${'sources'.padStart(7)}`));
    for (const [file, c] of r.unconfirmedByFile) {
      console.log(
        paint(
          `     ${file.padEnd(24)} ${String(c.unconfirmedFacts.length).padStart(5)}  ${String(c.unconfirmedSources.length).padStart(7)}`,
        ),
      );
    }
    console.log(
      paint(
        r.releaseMode
          ? '   Confirm each on the official page (or remove it) before releasing.'
          : '   The app labels these "Not yet confirmed". A release pack (or --release) fails on them.',
      ),
    );
    console.log(paint('━'.repeat(72)));
  }

  const errors = issues.list.filter((i) => i.level === 'error').length;
  const warnings = issues.list.length - errors;
  console.log('');
  if (errors) {
    console.log(color.red(color.bold(`✖ ${errors} error(s), ${warnings} warning(s).`)));
    return 1;
  }
  console.log(color.green(color.bold(`✔ All packs valid`)) + (warnings ? color.yellow(` (${warnings} warning(s))`) : '.'));
  return 0;
}

run(main);
