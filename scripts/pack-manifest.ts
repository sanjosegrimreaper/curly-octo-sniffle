/**
 * Recomputes the SHA-256 checksums in each pack's manifest.json.
 *
 *   npx tsx scripts/pack-manifest.ts [--pack <id>] [--packs-dir <dir>] [--force]
 *
 * `files` covers every JSON file in the pack folder except manifest.json itself.
 * All other fields (packId, status, version, minAppVersion, …) are kept as they are.
 * `generatedAt` is set to today only when a checksum changed (or with --force), so a
 * run with no data changes leaves the file untouched and produces no git diff.
 */
import fs from 'node:fs';
import path from 'node:path';

import { manifestSchema } from '../src/data/schemas';

import { color, parseArgs, readJsonFile, rel, run, todayLocal } from './lib/cli';
import { formatJson, writeFileAtomic } from './lib/format';
import {
  formatZodIssues,
  isPlainObject,
  listPackIds,
  manifestCoveredFiles,
  resolvePacksDir,
  sha256File,
} from './lib/packs';

function sameFiles(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  return ak.length === Object.keys(b).length && ak.every((k) => a[k] === b[k]);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), ['pack', 'packs-dir']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const only = args.value('pack');
  const today = todayLocal();
  const packIds = listPackIds(packsDir).filter((p) => !only || p === only);

  if (!packIds.length) {
    console.error(color.red(`✖ No data packs found in ${rel(packsDir)}/${only ? ` (looked for "${only}")` : ''}.`));
    return 1;
  }

  let failed = false;
  for (const pack of packIds) {
    const packDir = path.join(packsDir, pack);
    const manifestPath = path.join(packDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error(color.red(`✖ ${pack}: pack file missing: ${rel(manifestPath)} — create it with packId, status, version, minAppVersion, generatedAt and files.`));
      failed = true;
      continue;
    }
    const read = readJsonFile(manifestPath);
    if (!read.ok || !isPlainObject(read.json)) {
      console.error(color.red(`✖ ${pack}: ${read.ok ? 'manifest.json is not a JSON object' : read.error}`));
      failed = true;
      continue;
    }
    const current = read.json;

    const files: Record<string, string> = {};
    for (const f of manifestCoveredFiles(packDir)) files[f] = sha256File(path.join(packDir, f));

    const previous = isPlainObject(current.files) ? current.files : {};
    const prevStrings: Record<string, string> = {};
    for (const [k, v] of Object.entries(previous)) if (typeof v === 'string') prevStrings[k] = v;

    const changed = !sameFiles(prevStrings, files);
    if (!changed && !args.has('force')) {
      console.log(`${color.green('✔')} ${pack}: manifest up to date (${Object.keys(files).length} files)`);
      continue;
    }

    // Keep every existing field and its order; replace files and generatedAt.
    const next: Record<string, unknown> = { ...current, generatedAt: today, files };
    const check = manifestSchema.safeParse(next);
    if (!check.success) {
      console.error(color.red(`✖ ${pack}: the updated manifest would not pass its schema — not written:`));
      for (const line of formatZodIssues(check.error)) console.error(color.red(`    ${line}`));
      failed = true;
      continue;
    }

    writeFileAtomic(manifestPath, await formatJson(next, manifestPath));

    const added = Object.keys(files).filter((f) => !(f in prevStrings));
    const removed = Object.keys(prevStrings).filter((f) => !(f in files));
    const updated = Object.keys(files).filter((f) => f in prevStrings && prevStrings[f] !== files[f]);
    console.log(`${color.green('✔')} ${pack}: wrote ${rel(manifestPath)} (generatedAt ${today})`);
    for (const f of updated) console.log(`    ${color.yellow('~')} ${f}`);
    for (const f of added) console.log(`    ${color.green('+')} ${f}`);
    for (const f of removed) console.log(`    ${color.red('-')} ${f}`);
  }
  return failed ? 1 : 0;
}

run(main);
