/**
 * Generates VERIFICATION.md at the repo root from the data packs.
 *
 *   npx tsx scripts/gen-verification.ts           write VERIFICATION.md
 *   npx tsx scripts/gen-verification.ts --check   exit 1 if VERIFICATION.md is out of date (CI)
 *
 * Per pack: a header (pack id, version, status), one table per pack file listing every
 * sourced record (record, fact summary, sources, method, checked on, verified as of), a
 * "Not yet confirmed on the official page" section for records whose sources are all
 * unconfirmed, and "Unverified — not shipped" from data/packs/<id>/unverified.json.
 * Ends with the verification-methods legend. The "Generated" date is ignored by --check.
 */
import fs from 'node:fs';
import path from 'node:path';

import { verificationMethod } from '../src/data/schemas';

import { color, parseArgs, readJsonFile, rel, ROOT, run, todayLocal } from './lib/cli';
import { formatMarkdown, writeFileAtomic } from './lib/format';
import {
  formatPath,
  isConfirmedMethod,
  isLocalized,
  isPlainObject,
  lastKey,
  listPackIds,
  packFilesFor,
  parseWith,
  readPackRegistry,
  resolvePacksDir,
  UNVERIFIED_FILE,
  unverifiedSchema,
  walk,
  type JsonObject,
  type PathSeg,
  type UnverifiedItem,
} from './lib/packs';

const OUT = path.join(ROOT, 'VERIFICATION.md');
const GENERATED_LINE = /^_Generated: \d{4}-\d{2}-\d{2}_$/m;

const METHOD_TEXT: Readonly<Record<string, string>> = {
  'http-200': 'The official page loaded (HTTP 200) and showed the fact.',
  'browser-confirmed': 'A person checked the official page in a web browser (used for bot-protected sites).',
  'official-data-file': 'Read from an official downloadable data file.',
  'official-pdf': 'Read from an official PDF document.',
  'official-api': 'Read from an official data API (for example the data.medicaid.gov datastore).',
  'phone-confirmed': 'Confirmed by phone with the program or office.',
  unconfirmed:
    'Not yet confirmed on the official page (for example, seen only in a web-search result from the official domain). Allowed in draft packs only; the app labels it "Not yet confirmed".',
};

// ---------------------------------------------------------------- safe accessors

const str = (o: JsonObject, k: string): string | undefined => {
  const v = o[k];
  return typeof v === 'string' && v !== '' ? v : undefined;
};
const num = (o: JsonObject, k: string): number | undefined => {
  const v = o[k];
  return typeof v === 'number' ? v : undefined;
};
const en = (o: JsonObject, k: string): string | undefined => {
  const v = o[k];
  if (isLocalized(v)) return v.en;
  return typeof v === 'string' && v !== '' ? v : undefined;
};
const list = (o: JsonObject, k: string): unknown[] => {
  const v = o[k];
  return Array.isArray(v) ? v : [];
};
const usd = (dollars: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  }).format(dollars);
const cents = (c: number) => usd(c / 100);
const truncate = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const names = (items: unknown[]) =>
  items
    .map((c) => (typeof c === 'string' ? c : isPlainObject(c) ? (str(c, 'name') ?? str(c, 'id') ?? '') : ''))
    .filter(Boolean)
    .join(', ');

// ---------------------------------------------------------------- record summaries

function summarize(file: string, at: readonly PathSeg[], o: JsonObject): string {
  if (at.length === 0) {
    if (file === 'region.json') return `${en(o, 'name') ?? ''} — counties: ${names(list(o, 'counties')) || 'none'}`;
    if (file === 'prices/nadac.json') {
      return `NADAC feed as of ${str(o, 'asOfDate') ?? 'not loaded yet'} (dataset ${str(o, 'datasetId') ?? '—'}): ${list(o, 'entries').length} entr${list(o, 'entries').length === 1 ? 'y' : 'ies'}`;
    }
    if (file === 'prices/costplus.json') {
      return `Cost Plus snapshot ${str(o, 'snapshotDate') ?? 'not taken yet'}: ${list(o, 'quotes').length} quote(s), ${list(o, 'notListed').length} not listed`;
    }
  }
  switch (lastKey(at)) {
    case 'years': {
      const by = list(o, 'bySize').filter((v): v is number => typeof v === 'number');
      const first = by[0];
      const last = by[by.length - 1];
      const add = num(o, 'perAdditional');
      return `${num(o, 'year') ?? ''} poverty guidelines: household of 1 ${first !== undefined ? usd(first) : '?'} … of ${by.length} ${last !== undefined ? usd(last) : '?'}${add !== undefined ? `, +${usd(add)} per extra person` : ''}${str(o, 'effectiveDate') ? `; effective ${str(o, 'effectiveDate')}` : ''}`;
    }
    case 'rules':
      return `${en(o, 'title') ?? ''} → ${str(o, 'tier') ?? '?'} (${str(o, 'programKey') ?? '?'})`;
    case 'links':
      return `Link “${en(o, 'label') ?? ''}” → ${str(o, 'url') ?? ''}`;
    case 'medications':
      return `${en(o, 'displayName') ?? str(o, 'generic') ?? ''}: ${list(o, 'strengths').length} strength(s), ${str(o, 'marketStatus') ?? '?'}; programs: ${list(o, 'programIds').join(', ') || 'none'}`;
    case 'programs': {
      const fplMax = num(o, 'fplMax');
      const fplYear = num(o, 'fplYear');
      const cap =
        fplMax !== undefined
          ? `${fplMax}% FPL${fplYear !== undefined ? ` (${fplYear} guidelines)` : ''}`
          : 'not published';
      return `${str(o, 'name') ?? ''} (${str(o, 'sponsor') ?? '?'}) — ${str(o, 'kind') ?? '?'}; income cap ${cap}; insurance rule ${str(o, 'insuranceRule') ?? '?'}${o.closedToNew === true ? '; closed to new applicants' : ''}${str(o, 'phone') ? `; phone ${str(o, 'phone')}` : ''}`;
    }
    case 'outlooks':
      return `${str(o, 'medicationId') ?? ''}: ${str(o, 'kind') ?? ''}${str(o, 'earliestDate') ? `, earliest ${str(o, 'earliestDate')}` : ''}${str(o, 'label') ? ` — ${str(o, 'label')}` : ''}`;
    case 'pharmacies':
    case 'clinics': {
      const place = [str(o, 'address'), str(o, 'city'), str(o, 'zip')].filter(Boolean).join(', ');
      const org = str(o, 'organization');
      return `${str(o, 'name') ?? ''}${org ? ` (${org})` : ''}${place ? ` — ${place}` : ''}${str(o, 'phone') ? `; ${str(o, 'phone')}` : ''}${o.addressVerified === false ? ' (address not verified)' : ''}`;
    }
    case 'helpers':
      return `${en(o, 'name') ?? ''}${str(o, 'phone') ? ` — ${str(o, 'phone')}` : ''}${str(o, 'forWhom') ? ` (for ${str(o, 'forWhom')})` : ''}`;
    case 'notices':
      return `${en(o, 'title') ?? ''}${str(o, 'effectiveDate') ? ` (effective ${str(o, 'effectiveDate')})` : ''}`;
    case 'facts':
      return `${en(o, 'title') ?? ''}: ${en(o, 'body') ?? ''}`;
    case 'terms':
      return `${en(o, 'term') ?? ''}: ${en(o, 'definition') ?? ''}`;
    case 'formula': {
      const ship = num(o, 'shippingCents');
      return `Price formula: cost + ${num(o, 'markupPercent') ?? '?'}% markup + ${cents(num(o, 'pharmacyFeeCents') ?? 0)} pharmacy fee; shipping ${ship !== undefined ? cents(ship) : 'not listed'}`;
    }
    case 'prices': {
      const pc = num(o, 'priceCents');
      const qty = num(o, 'quantity');
      return `${str(o, 'seller') ?? ''}: ${o.priceKind === 'maximum' ? 'up to ' : ''}${pc !== undefined ? cents(pc) : '?'} per ${en(o, 'per') ?? (qty !== undefined ? String(qty) : '?')} — ${en(o, 'description') ?? ''}`;
    }
    default:
      return en(o, 'title') ?? en(o, 'name') ?? en(o, 'label') ?? en(o, 'term') ?? en(o, 'description') ?? '';
  }
}

function recordName(o: JsonObject): string | undefined {
  return en(o, 'displayName') ?? en(o, 'name') ?? en(o, 'title') ?? en(o, 'term') ?? en(o, 'label') ?? str(o, 'seller');
}

// ---------------------------------------------------------------- markdown

const cell = (s: string) => s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
const linkText = (s: string) => s.replace(/([[\]])/g, '\\$1');
const linkUrl = (s: string) => s.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');

type Source = { name: string; url: string; method: string; checkedOn: string; edition?: string; note?: string };
type Row = { file: string; path: string; name?: string; fact: string; sources: Source[]; verifiedAsOf: string };

function readSources(o: JsonObject): Source[] {
  return list(o, 'sources')
    .filter(isPlainObject)
    .map((s) => ({
      name: str(s, 'name') ?? '(unnamed source)',
      url: str(s, 'url') ?? '',
      method: str(s, 'method') ?? '(none)',
      checkedOn: str(s, 'checkedOn') ?? '—',
      edition: str(s, 'edition'),
      note: str(s, 'note'),
    }));
}

function sourceCell(sources: readonly Source[], withNotes: boolean): string {
  return sources
    .map((s) => {
      const link = s.url ? `[${linkText(s.name)}](${linkUrl(s.url)})` : linkText(s.name);
      const edition = s.edition ? ` — ${s.edition}` : '';
      const note = withNotes && s.note ? `<br>_${s.note}_` : '';
      return link + edition + note;
    })
    .join('<br>');
}

function recordCell(r: Row): string {
  return `\`${r.path}\`${r.name ? `<br>${r.name}` : ''}`;
}

function collectRows(file: string, json: unknown): Row[] {
  const rows: Row[] = [];
  walk(json, (value, at) => {
    if (!isPlainObject(value) || !('sources' in value)) return;
    rows.push({
      file,
      path: at.length ? formatPath(at) : '(whole file)',
      name: recordName(value),
      fact: truncate(summarize(file, at, value)),
      sources: readSources(value),
      verifiedAsOf: str(value, 'verifiedAsOf') ?? '—',
    });
  });
  return rows;
}

const isUnconfirmedRow = (r: Row) => r.sources.length > 0 && r.sources.every((s) => !isConfirmedMethod(s.method));

type PackData = {
  id: string;
  manifest: JsonObject;
  files: { file: string; rows: Row[] }[];
  unverified: UnverifiedItem[] | null;
};

function renderPack(p: PackData): string {
  const out: string[] = [];
  const all = p.files.flatMap((f) => f.rows);
  const unconfirmed = all.filter(isUnconfirmedRow);
  const version = str(p.manifest, 'version') ?? '?';
  const status = str(p.manifest, 'status') ?? '?';

  out.push(`## Pack \`${p.id}\` — version ${version} (${status})`);
  out.push('');
  out.push(
    `Pack generated ${str(p.manifest, 'generatedAt') ?? '?'}; minimum app version ${str(p.manifest, 'minAppVersion') ?? '?'}.`,
  );
  out.push('');
  out.push(
    `**${all.length} sourced facts** — ${all.length - unconfirmed.length} confirmed on an official source, ` +
      `${unconfirmed.length} not yet confirmed. **${p.unverified?.length ?? 0} item(s) unverified and not shipped.**`,
  );
  if (status === 'draft' && unconfirmed.length) {
    out.push('');
    out.push(
      '> This is a **draft** pack: facts listed under "Not yet confirmed on the official page" must be confirmed (or removed) before the pack can be marked `release`.',
    );
  }
  out.push('');

  for (const { file, rows } of p.files) {
    const confirmed = rows.filter((r) => !isUnconfirmedRow(r));
    const pending = rows.length - confirmed.length;
    out.push(`### \`${file}\``);
    out.push('');
    if (!rows.length) {
      out.push('_No sourced records in this file._');
      out.push('');
      continue;
    }
    if (!confirmed.length) {
      out.push(
        `_No confirmed facts yet — all ${pending} are listed under "Not yet confirmed on the official page" below._`,
      );
      out.push('');
      continue;
    }
    if (pending) {
      out.push(`${pending} more fact(s) from this file are listed under "Not yet confirmed on the official page".`);
      out.push('');
    }
    out.push('| Record | Fact | Source | Method | Checked on | Verified as of |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of confirmed) {
      const methods = r.sources
        .map((s) => (isConfirmedMethod(s.method) ? `\`${s.method}\`` : `\`${s.method}\` (not confirmed)`))
        .join('<br>');
      out.push(
        `| ${cell(recordCell(r))} | ${cell(r.fact)} | ${cell(sourceCell(r.sources, false))} | ${cell(methods)} | ${cell(r.sources.map((s) => s.checkedOn).join('<br>'))} | ${r.verifiedAsOf} |`,
      );
    }
    out.push('');
  }

  out.push(`### Not yet confirmed on the official page`);
  out.push('');
  if (!unconfirmed.length) {
    out.push('_None — every fact has at least one confirmed source._');
  } else {
    out.push(
      'Every source for these facts is unconfirmed — for example, the fact was seen only in a web-search result from the official domain because the page could not be opened. The app labels them "Not yet confirmed". Confirm each on the official page, then change its method.',
    );
    out.push('');
    out.push('| File | Record | Fact | Source and note | Checked on | Verified as of |');
    out.push('| --- | --- | --- | --- | --- | --- |');
    for (const r of unconfirmed) {
      out.push(
        `| \`${r.file}\` | ${cell(recordCell(r))} | ${cell(r.fact)} | ${cell(sourceCell(r.sources, true))} | ${cell(r.sources.map((s) => s.checkedOn).join('<br>'))} | ${r.verifiedAsOf} |`,
      );
    }
  }
  out.push('');

  out.push(`### Unverified — not shipped`);
  out.push('');
  if (p.unverified === null) {
    out.push(`_No \`${UNVERIFIED_FILE}\` in this pack._`);
  } else if (!p.unverified.length) {
    out.push('_Nothing recorded._');
  } else {
    out.push('These were researched but could not be verified, so the app does not show them.');
    out.push('');
    out.push('| Item | Reason | Last tried |');
    out.push('| --- | --- | --- |');
    for (const u of p.unverified) out.push(`| ${cell(u.item)} | ${cell(u.reason)} | ${u.lastTried} |`);
  }
  out.push('');
  return out.join('\n');
}

function renderLegend(): string {
  const out = ['## Verification methods', '', '| Method | Meaning | Counts as confirmed |', '| --- | --- | --- |'];
  for (const m of verificationMethod.options) {
    out.push(
      `| \`${m}\` | ${cell(METHOD_TEXT[m] ?? '(no description — add one in scripts/gen-verification.ts)')} | ${isConfirmedMethod(m) ? 'yes' : 'no'} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

function loadPacks(packsDir: string, problems: string[]): PackData[] {
  const registry = readPackRegistry();
  const existing = listPackIds(packsDir);
  // Only packs the app ships (PACK_FILES); test fixtures in other folders are left out.
  const ids = registry ? [...registry.keys()] : existing;
  const packs: PackData[] = [];
  for (const id of ids) {
    const dir = path.join(packsDir, id);
    if (!existing.includes(id)) {
      problems.push(`pack folder missing: ${rel(dir)}/ (registered in PACK_FILES)`);
      continue;
    }
    const files: PackData['files'] = [];
    let manifest: JsonObject = {};
    for (const file of packFilesFor(id, registry)) {
      const full = path.join(dir, file);
      if (!fs.existsSync(full)) {
        problems.push(`pack file missing: ${rel(full)}`);
        continue;
      }
      const r = readJsonFile(full);
      if (!r.ok) {
        problems.push(r.error);
        continue;
      }
      if (file === 'manifest.json') {
        if (isPlainObject(r.json)) manifest = r.json;
        continue;
      }
      files.push({ file, rows: collectRows(file, r.json) });
    }
    let unverified: UnverifiedItem[] | null = null;
    const uPath = path.join(dir, UNVERIFIED_FILE);
    if (fs.existsSync(uPath)) {
      const r = readJsonFile(uPath);
      const parsed = r.ok ? parseWith(unverifiedSchema, r.json) : null;
      if (!parsed)
        problems.push(`${rel(uPath)} must be an array of { item, reason, lastTried } (run npm run check:packs)`);
      unverified = parsed ?? [];
    }
    packs.push({ id, manifest, files, unverified });
  }
  if (!ids.length) problems.push(`no data packs found in ${rel(packsDir)}/`);
  return packs;
}

async function buildReport(packsDir: string, today: string, problems: string[]): Promise<string> {
  const packs = loadPacks(packsDir, problems);
  const parts = [
    '# Verification report',
    '',
    '> Generated by `scripts/gen-verification.ts` from `data/packs/`. Do not edit by hand — run `npm run gen:verification`. CI fails when this file is out of date.',
    '',
    `_Generated: ${today}_`,
    '',
    ...packs.map(renderPack),
    renderLegend(),
  ];
  return formatMarkdown(parts.join('\n'), OUT);
}

const normalize = (s: string) => s.replace(GENERATED_LINE, '_Generated: (date)_');

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), ['packs-dir']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const problems: string[] = [];
  const report = await buildReport(packsDir, todayLocal(), problems);

  if (problems.length) {
    for (const p of problems) console.error(color.red(`✖ ${p}`));
    console.error(color.red(`VERIFICATION.md was not ${args.has('check') ? 'checked' : 'written'}.`));
    return 1;
  }

  if (args.has('check')) {
    if (!fs.existsSync(OUT)) {
      console.error(color.red(`✖ ${rel(OUT)} does not exist. Run: npm run gen:verification`));
      return 1;
    }
    const current = fs.readFileSync(OUT, 'utf8');
    if (normalize(current) !== normalize(report)) {
      const a = normalize(current).split('\n');
      const b = normalize(report).split('\n');
      const i = a.findIndex((line, n) => line !== b[n]);
      const at = i === -1 ? Math.min(a.length, b.length) : i;
      console.error(color.red(`✖ ${rel(OUT)} is out of date (first difference at line ${at + 1}).`));
      console.error(color.dim(`  file:      ${(a[at] ?? '(end of file)').slice(0, 160)}`));
      console.error(color.dim(`  generated: ${(b[at] ?? '(end of file)').slice(0, 160)}`));
      console.error(`  Run: npm run gen:verification`);
      return 1;
    }
    console.log(color.green(`✔ ${rel(OUT)} is up to date.`));
    return 0;
  }

  writeFileAtomic(OUT, report);
  console.log(color.green(`✔ Wrote ${rel(OUT)} (${report.split('\n').length} lines).`));
  return 0;
}

run(main);
