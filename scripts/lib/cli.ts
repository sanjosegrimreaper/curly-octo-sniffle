/**
 * Small helpers shared by the scripts in scripts/: repo paths, argument parsing,
 * colors, dates and plain-text tables. No dependencies beyond Node.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Repository root (scripts/lib/ -> repo). */
export const ROOT = path.resolve(__dirname, '..', '..');

/** Path relative to the repo root, with forward slashes (stable across OSes). */
export function rel(p: string): string {
  const r = path.relative(ROOT, p);
  if (r.startsWith('..') || path.isAbsolute(r)) return p;
  return (r === '' ? '.' : r).split(path.sep).join('/');
}

// ---------------------------------------------------------------- args

export type Args = {
  has: (flag: string) => boolean;
  value: (name: string) => string | undefined;
};

/** Parses `--flag`, `--name=value` and `--name value` (for names listed in `valued`). */
export function parseArgs(argv: readonly string[], valued: readonly string[] = []): Args {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined || !a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) {
      values.set(a.slice(2, eq), a.slice(eq + 1));
      continue;
    }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (valued.includes(name) && next !== undefined && !next.startsWith('--')) {
      values.set(name, next);
      i++;
    } else {
      flags.add(name);
    }
  }
  return { has: (f) => flags.has(f), value: (n) => values.get(n) };
}

// ---------------------------------------------------------------- colors

const colorOn = (Boolean(process.stdout.isTTY) && !process.env.NO_COLOR) || Boolean(process.env.FORCE_COLOR);
const wrap = (code: number) => (s: string) => (colorOn ? `\x1b[${code}m${s}\x1b[0m` : s);
export const color = {
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  cyan: wrap(36),
  dim: wrap(2),
  bold: wrap(1),
};

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const visibleLength = (s: string) => s.replace(ANSI, '').length;

/** Plain-text table with aligned columns. */
export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = headers.map((h, i) => Math.max(visibleLength(h), ...rows.map((r) => visibleLength(r[i] ?? ''))));
  const line = (cells: readonly string[]) =>
    cells.map((cell, i) => cell + ' '.repeat(Math.max(0, (widths[i] ?? 0) - visibleLength(cell)))).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [line(headers), sep, ...rows.map(line)].join('\n');
}

// ---------------------------------------------------------------- dates

/** Today's date in the machine's local time zone, as YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True for a YYYY-MM-DD string that names a real calendar day (rejects 2026-02-30). */
export function isRealDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// ---------------------------------------------------------------- files

export function readJsonFile(file: string): { ok: true; json: unknown; raw: string } | { ok: false; error: string } {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { ok: false, error: `cannot read ${rel(file)}: ${errorMessage(e)}` };
  }
  try {
    return { ok: true, json: JSON.parse(raw) as unknown, raw };
  } catch (e) {
    return { ok: false, error: `${rel(file)} is not valid JSON: ${errorMessage(e)}` };
  }
}

/** Recursively lists files under `dir` whose names pass `filter`. Sorted for stable output. */
export function listFiles(dir: string, filter: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, filter));
    else if (entry.isFile() && filter(entry.name)) out.push(full);
  }
  return out.sort();
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Runs an async main; prints a one-line error (no stack) and exits 1 on an unexpected failure. */
export function run(main: () => Promise<number> | number): void {
  Promise.resolve()
    .then(main)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((e: unknown) => {
      console.error(color.red(`✖ ${errorMessage(e)}`));
      if (process.env.DEBUG) console.error(e);
      process.exitCode = 1;
    });
}
