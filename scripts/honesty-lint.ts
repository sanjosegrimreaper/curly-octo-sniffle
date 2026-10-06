/**
 * Honesty linter: fails on absolute claims in user-facing text.
 *
 *   npx tsx scripts/honesty-lint.ts [--packs-dir <dir>]
 *
 * Scans every value in src/i18n/locales/<lang>/*.json and every localized string
 * ({ en, es, zh-Hans, hi }) inside data/packs/**\/*.json, using the per-language lists in
 * scripts/lib/honesty.ts ("guaranteed", "you qualify", "will save", "garantizado", "保证", …).
 * English text is also checked for "will"/"'ll" next to drop|save|qualify|approve|launch,
 * and for an unhedged "cheaper".
 *
 * A value may contain a listed phrase only when its file + key path is in
 * scripts/honesty-allow.json with a justification (e.g. a sentence that says
 * "This is not guaranteed").
 */
import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { color, listFiles, parseArgs, readJsonFile, rel, ROOT, run, table } from './lib/cli';
import { findForbidden, hasRulesFor, type Finding } from './lib/honesty';
import { flatten } from './lib/i18n';
import { formatPath, formatZodIssues, isLocalized, resolvePacksDir, walk } from './lib/packs';

const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const ALLOW_FILE = path.join(ROOT, 'scripts', 'honesty-allow.json');

const allowSchema = z.object({
  $comment: z.string().optional(),
  allow: z.array(
    z.object({
      /** Repo-relative file, e.g. "src/i18n/locales/en/results.json". */
      file: z.string().min(1),
      /** Key path as this script prints it, e.g. "disclaimer.notGuaranteed" or "programs[bmspaf].description.es". */
      path: z.string().min(1),
      /** Optional: allow only this phrase at that path. */
      phrase: z.string().optional(),
      justification: z.string().min(10, 'Say why this wording is honest (at least 10 characters)'),
    }),
  ),
});
type AllowEntry = z.infer<typeof allowSchema>['allow'][number];

type Hit = { file: string; keyPath: string; lang: string; text: string; finding: Finding };

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  const s = text.slice(start, end).replace(/\s+/g, ' ');
  return `${start > 0 ? '…' : ''}${s}${end < text.length ? '…' : ''}`;
}

function main(): number {
  const args = parseArgs(process.argv.slice(2), ['packs-dir']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const hits: Hit[] = [];
  const noRules = new Set<string>();
  let scanned = 0;

  const check = (file: string, keyPath: string, lang: string, text: string) => {
    scanned++;
    if (!hasRulesFor(lang)) noRules.add(lang);
    for (const finding of findForbidden(text, lang)) hits.push({ file, keyPath, lang, text, finding });
  };

  // Allow-list
  let allow: AllowEntry[] = [];
  if (fs.existsSync(ALLOW_FILE)) {
    const r = readJsonFile(ALLOW_FILE);
    if (!r.ok) {
      console.error(color.red(`✖ ${r.error}`));
      return 1;
    }
    const parsed = allowSchema.safeParse(r.json);
    if (!parsed.success) {
      console.error(color.red(`✖ ${rel(ALLOW_FILE)} is invalid:`));
      for (const line of formatZodIssues(parsed.error)) console.error(color.red(`    ${line}`));
      return 1;
    }
    allow = parsed.data.allow;
  }

  // 1. App copy
  const localeFiles = listFiles(LOCALES_DIR, (n) => n.endsWith('.json'));
  for (const file of localeFiles) {
    const lang = path.basename(path.dirname(file));
    const r = readJsonFile(file);
    if (!r.ok) {
      console.error(color.red(`✖ ${r.error}`));
      return 1;
    }
    for (const [key, value] of flatten(r.json)) if (typeof value === 'string') check(rel(file), key, lang, value);
  }

  // 2. Localized strings in data packs
  const packFiles = listFiles(packsDir, (n) => n.endsWith('.json'));
  for (const file of packFiles) {
    const r = readJsonFile(file);
    if (!r.ok) {
      console.error(color.red(`✖ ${r.error}`));
      return 1;
    }
    walk(r.json, (value, at) => {
      if (!isLocalized(value)) return;
      for (const [lang, text] of Object.entries(value)) check(rel(file), `${formatPath(at)}.${lang}`, lang, text);
    });
  }

  // Apply the allow-list
  const used = new Set<AllowEntry>();
  const blocked: Hit[] = [];
  let allowed = 0;
  for (const h of hits) {
    const entry = allow.find(
      (a) =>
        a.file === h.file &&
        a.path === h.keyPath &&
        (a.phrase === undefined || a.phrase.toLowerCase() === h.finding.phrase.toLowerCase()),
    );
    if (entry) {
      used.add(entry);
      allowed++;
    } else {
      blocked.push(h);
    }
  }

  console.log(
    color.bold('Honesty lint') +
      color.dim(
        ` — ${scanned} strings in ${localeFiles.length} locale file(s) and ${packFiles.length} pack file(s); ${allow.length} allow-list entr${allow.length === 1 ? 'y' : 'ies'}`,
      ),
  );
  for (const lang of noRules) {
    console.log(
      color.yellow(
        `warn  no forbidden-phrase list for "${lang}" — only the English list was applied (add one in scripts/lib/honesty.ts)`,
      ),
    );
  }
  for (const a of allow) {
    if (!used.has(a))
      console.log(
        color.yellow(`warn  unused allow-list entry: ${a.file} ${a.path} — remove it from ${rel(ALLOW_FILE)}`),
      );
  }

  if (blocked.length) {
    console.log('');
    console.log(
      table(
        ['File', 'Key path', 'Lang', 'Phrase', 'Text'],
        blocked.map((h) => [
          h.file,
          h.keyPath,
          h.lang,
          color.red(h.finding.rule === 'cheaper' ? `${h.finding.phrase} (unhedged)` : h.finding.phrase),
          excerpt(h.text, h.finding.index, h.finding.phrase.length),
        ]),
      ),
    );
    console.log('');
    console.log(
      color.red(color.bold(`✖ ${blocked.length} absolute claim(s) found.`)) +
        ' Use hedged wording ("may qualify", "could drop", "may be cheaper"), or — only for text that is honest, like "This is not guaranteed" — add the file + key path with a justification to ' +
        rel(ALLOW_FILE) +
        '.',
    );
    return 1;
  }
  console.log(
    color.green(color.bold('✔ No absolute claims found')) +
      (allowed ? color.dim(` (${allowed} allowed by the allow-list)`) : '.'),
  );
  return 0;
}

run(main);
