/**
 * Translation parity for src/i18n/locales/<lang>/<ns>.json.
 *
 *   npx tsx scripts/i18n-parity.ts
 *
 * Errors (exit 1)
 *  - a language is missing a namespace file that en has, or has one en doesn't;
 *  - a language is missing keys that en has, or has extra keys (nested, flattened).
 *    i18next plural forms (_zero/_one/_two/_few/_many/_other, also _ordinal_*) count as one
 *    logical key, because languages need different forms (zh only needs _other);
 *  - a plural family without its `_other` form;
 *  - {{placeholders}} differ from en for the same key;
 *  - empty strings, or values that are not strings.
 * Warnings
 *  - a plural family lacks a form CLDR says the language uses (Intl.PluralRules);
 *  - JSX text or a text prop in src/app, src/components, src/design that looks hard-coded
 *    (add `// i18n-ignore` on the line to silence a false positive).
 */
import fs from 'node:fs';
import path from 'node:path';

import { color, listFiles, readJsonFile, rel, ROOT, run, table } from './lib/cli';
import { flatten, logicalKeys, placeholders, requiredPluralCategories } from './lib/i18n';

const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const SCAN_DIRS = ['src/app', 'src/components', 'src/design'].map((d) => path.join(ROOT, d));
const BASE = 'en';
const MAX_KEYS_SHOWN = 40;

type Problem = { file: string; message: string };

function listKeys(keys: readonly string[]): string {
  const shown = keys.slice(0, MAX_KEYS_SHOWN).join(', ');
  return keys.length > MAX_KEYS_SHOWN ? `${shown}, …and ${keys.length - MAX_KEYS_SHOWN} more` : shown;
}

function unionPlaceholders(forms: ReadonlyMap<string, unknown>): string[] {
  const all = new Set<string>();
  for (const v of forms.values()) if (typeof v === 'string') for (const p of placeholders(v)) all.add(p);
  return [...all].sort();
}

type LangStats = { files: number; keys: number; missing: number; extra: number; placeholder: number; empty: number };

function checkLocales(errors: Problem[], warnings: Problem[]): Map<string, LangStats> {
  const stats = new Map<string, LangStats>();
  if (!fs.existsSync(path.join(LOCALES_DIR, BASE))) {
    errors.push({ file: rel(LOCALES_DIR), message: `no "${BASE}" folder — it is the reference language` });
    return stats;
  }
  const langs = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => (a === BASE ? -1 : b === BASE ? 1 : a.localeCompare(b)));
  const nsOf = (lang: string) =>
    fs
      .readdirSync(path.join(LOCALES_DIR, lang))
      .filter((f) => f.endsWith('.json'))
      .sort();
  const baseNs = nsOf(BASE);

  const load = (lang: string, ns: string): Map<string, unknown> | null => {
    const file = path.join(LOCALES_DIR, lang, ns);
    const r = readJsonFile(file);
    if (!r.ok) {
      errors.push({ file: rel(file), message: r.error });
      return null;
    }
    return flatten(r.json);
  };

  const base = new Map(baseNs.map((ns) => [ns, load(BASE, ns)]));
  const missingForms = new Map<string, Set<string>>(); // "lang:category" → logical keys

  for (const lang of langs) {
    const s: LangStats = { files: 0, keys: 0, missing: 0, extra: 0, placeholder: 0, empty: 0 };
    stats.set(lang, s);
    const files = nsOf(lang);
    for (const ns of files) {
      if (!baseNs.includes(ns)) {
        errors.push({ file: rel(path.join(LOCALES_DIR, lang, ns)), message: `extra namespace — ${BASE} has no ${ns}` });
      }
    }
    for (const ns of baseNs) {
      const fileRel = rel(path.join(LOCALES_DIR, lang, ns));
      if (!files.includes(ns)) {
        errors.push({ file: fileRel, message: `missing namespace file (${BASE} has ${ns})` });
        continue;
      }
      s.files++;
      const flat = lang === BASE ? base.get(ns) : load(lang, ns);
      const baseFlat = base.get(ns);
      if (!flat || !baseFlat) continue;

      // Values: strings only, never empty.
      for (const [key, value] of flat) {
        if (typeof value !== 'string') {
          errors.push({
            file: fileRel,
            message: `${key}: value must be a string (found ${value === null ? 'null' : typeof value})`,
          });
        } else if (value.trim() === '') {
          s.empty++;
          errors.push({ file: fileRel, message: `${key}: empty string` });
        }
      }

      const mine = logicalKeys(flat);
      const ref = logicalKeys(baseFlat);
      s.keys += mine.size;

      // Plural families: need _other; warn on CLDR forms the language uses but lacks.
      for (const [logical, { forms, info }] of mine) {
        if (info.kind !== 'plural') continue;
        const has = new Set([...forms.keys()].map((k) => k.slice(k.lastIndexOf('_') + 1)));
        if (!has.has('other')) {
          errors.push({
            file: fileRel,
            message: `${logical.replace('{plural}', 'other')}: plural family has no _other form`,
          });
        }
        for (const cat of requiredPluralCategories(lang, info.ordinal)) {
          if (cat === 'other' || has.has(cat)) continue;
          const k = `${lang}:${cat}`;
          missingForms.set(k, (missingForms.get(k) ?? new Set()).add(`${ns.replace('.json', '')}:${info.base}`));
        }
      }

      if (lang === BASE) continue;

      const missing = [...ref.keys()].filter((k) => !mine.has(k));
      const extra = [...mine.keys()].filter((k) => !ref.has(k));
      s.missing += missing.length;
      s.extra += extra.length;
      if (missing.length)
        errors.push({ file: fileRel, message: `missing ${missing.length} key(s): ${listKeys(missing)}` });
      if (extra.length)
        errors.push({ file: fileRel, message: `extra ${extra.length} key(s) not in ${BASE}: ${listKeys(extra)}` });

      for (const [logical, { forms }] of mine) {
        const r = ref.get(logical);
        if (!r) continue;
        const a = unionPlaceholders(r.forms);
        const b = unionPlaceholders(forms);
        if (a.join('|') !== b.join('|')) {
          s.placeholder++;
          const fmt = (l: string[]) => (l.length ? l.map((p) => `{{${p}}}`).join(' ') : '(none)');
          errors.push({
            file: fileRel,
            message: `${logical}: placeholders differ — ${BASE} ${fmt(a)} vs ${lang} ${fmt(b)}`,
          });
        }
      }
    }
  }

  for (const [k, keys] of missingForms) {
    const [lang, cat] = k.split(':');
    warnings.push({
      file: rel(path.join(LOCALES_DIR, lang ?? '')),
      message: `${keys.size} plural famil${keys.size === 1 ? 'y lacks' : 'ies lack'} the "_${cat}" form that ${lang} uses (Intl.PluralRules) — i18next would fall back: ${listKeys([...keys])}`,
    });
  }
  return stats;
}

// ---------------------------------------------------------------- hard-coded UI strings

const JSX_TEXT = /(?<![=\-])>([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g;
const TEXT_PROP = /\b(accessibilityLabel|accessibilityHint|placeholder|title|label|alt)="([^"]*[A-Za-z]{3,}[^"]*)"/g;
/** Captured text that is really code: assignments, calls, logic, or a ternary continuing after a tag. */
const CODE_HINT = /[=;()]|&&|\|\||^[:?]/;
const CODE_LINE =
  /^(return|export|import|const|let|var|type|interface|if|else|case|default|break|continue|throw|await|yield|function)\b/;

function scanHardcoded(warnings: Problem[]): number {
  let count = 0;
  const files = SCAN_DIRS.flatMap((d) => listFiles(d, (n) => n.endsWith('.tsx')));
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let prev = '';
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const where = `${rel(file)}:${i + 1}`;
      const skip =
        line.includes('i18n-ignore') || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
      if (!skip) {
        for (const m of line.matchAll(JSX_TEXT)) {
          const text = (m[1] ?? '').replace(/&[a-z]+;/g, ' ').trim();
          if (!text || CODE_HINT.test(text) || !/[A-Za-z]{3,}/.test(text)) continue;
          warnings.push({ file: where, message: `JSX text looks hard-coded: "${text}" — use t()` });
          count++;
        }
        for (const m of line.matchAll(TEXT_PROP)) {
          warnings.push({ file: where, message: `${m[1]}="${m[2]}" looks hard-coded — use t()` });
          count++;
        }
        // Text child on its own line between tags.
        const prevTrim = prev.trim();
        if (
          prevTrim.endsWith('>') &&
          !prevTrim.endsWith('=>') &&
          /^[A-Za-z][\w ,.'’!?:-]*$/.test(trimmed) &&
          /[A-Za-z]{3,}/.test(trimmed) &&
          trimmed.includes(' ') &&
          !CODE_LINE.test(trimmed)
        ) {
          warnings.push({ file: where, message: `JSX text looks hard-coded: "${trimmed}" — use t()` });
          count++;
        }
      }
      if (trimmed) prev = line;
    });
  }
  return count;
}

function printProblems(list: readonly Problem[], level: 'error' | 'warn') {
  const tag = level === 'error' ? color.red('error') : color.yellow('warn ');
  const byFile = new Map<string, string[]>();
  for (const p of list) byFile.set(p.file, [...(byFile.get(p.file) ?? []), p.message]);
  for (const [file, msgs] of byFile) {
    console.log(color.bold(`  ${file}`));
    for (const m of msgs) console.log(`    ${tag}  ${m}`);
  }
}

function main(): number {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  console.log(color.bold(`Checking translations in ${rel(LOCALES_DIR)}/ against "${BASE}"`));

  const stats = checkLocales(errors, warnings);
  const hardcoded = scanHardcoded(warnings);

  if (errors.length) {
    console.log('');
    printProblems(errors, 'error');
  }
  if (warnings.length) {
    console.log('');
    printProblems(warnings, 'warn');
  }

  console.log('');
  console.log(
    table(
      ['Language', 'Files', 'Logical keys', 'Missing', 'Extra', 'Placeholder diffs', 'Empty', 'Status'],
      [...stats].map(([lang, s]) => {
        const bad =
          s.missing + s.extra + s.placeholder + s.empty > 0 || errors.some((e) => e.file.includes(`/locales/${lang}/`));
        return [
          lang + (lang === BASE ? color.dim(' (base)') : ''),
          String(s.files),
          String(s.keys),
          s.missing ? color.red(String(s.missing)) : '0',
          s.extra ? color.red(String(s.extra)) : '0',
          s.placeholder ? color.red(String(s.placeholder)) : '0',
          s.empty ? color.red(String(s.empty)) : '0',
          bad ? color.red('FAIL') : color.green('ok'),
        ];
      }),
    ),
  );
  console.log(
    color.dim(`Hard-coded string scan (${SCAN_DIRS.map((d) => rel(d)).join(', ')}): ${hardcoded} warning(s).`),
  );
  console.log('');
  if (errors.length) {
    console.log(color.red(color.bold(`✖ ${errors.length} translation error(s), ${warnings.length} warning(s).`)));
    return 1;
  }
  console.log(
    color.green(color.bold('✔ Translations are in parity')) +
      (warnings.length ? color.yellow(` (${warnings.length} warning(s))`) : '.'),
  );
  return 0;
}

run(main);
