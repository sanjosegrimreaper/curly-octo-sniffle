/**
 * Shared data-pack helpers for the scripts: where packs live, which file uses which
 * Zod schema, and a JSON walker that produces readable key paths.
 *
 * We do NOT import src/data/pack.ts (it imports JSON through the '@data' alias, which
 * plain Node can't resolve). Instead the PACK_FILES keys are read from its source text,
 * so adding a file there is picked up here automatically.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { z, type ZodType } from 'zod';

import {
  benefitsSchema,
  clinicsSchema,
  CONFIRMED_METHODS,
  costPlusSnapshotSchema,
  directPricesSchema,
  factsSchema,
  fplSchema,
  glossarySchema,
  helpersSchema,
  isoDate,
  manifestSchema,
  medicationsSchema,
  nadacFeedSchema,
  noticesSchema,
  outlooksSchema,
  pharmaciesSchema,
  programsSchema,
  regionSchema,
} from '../../src/data/schemas';
import { LAUNCH_LANGUAGES } from '../../src/i18n/languages';

import { ROOT } from './cli';

export { LAUNCH_LANGUAGES };

export const DEFAULT_PACKS_DIR = path.join(ROOT, 'data', 'packs');
export const PACK_TS = path.join(ROOT, 'src', 'data', 'pack.ts');

/** File → schema, mirroring buildPack() in src/data/pack.ts. */
export const FILE_SCHEMAS: Readonly<Record<string, ZodType<unknown>>> = {
  'manifest.json': manifestSchema,
  'region.json': regionSchema,
  'fpl.json': fplSchema,
  'benefits.json': benefitsSchema,
  'medications.json': medicationsSchema,
  'programs.json': programsSchema,
  'outlook.json': outlooksSchema,
  'pharmacies.json': pharmaciesSchema,
  'clinics.json': clinicsSchema,
  'helpers.json': helpersSchema,
  'notices.json': noticesSchema,
  'facts.json': factsSchema,
  'glossary.json': glossarySchema,
  'prices/costplus.json': costPlusSnapshotSchema,
  'prices/nadac.json': nadacFeedSchema,
  'prices/direct.json': directPricesSchema,
};

/** Optional, not shipped: things we tried to verify and could not (listed in VERIFICATION.md). */
export const UNVERIFIED_FILE = 'unverified.json';
export const unverifiedSchema = z.array(
  z.object({
    item: z.string().min(1),
    reason: z.string().min(1),
    lastTried: isoDate,
  }),
);
export type UnverifiedItem = z.infer<typeof unverifiedSchema>[number];

const CONFIRMED: ReadonlySet<string> = new Set<string>(CONFIRMED_METHODS);
/** A source counts as confirmed only when its method is one of CONFIRMED_METHODS. */
export function isConfirmedMethod(method: unknown): boolean {
  return typeof method === 'string' && CONFIRMED.has(method);
}

// ---------------------------------------------------------------- pack discovery

export function resolvePacksDir(option: string | undefined): string {
  return option ? path.resolve(option) : DEFAULT_PACKS_DIR;
}

export function listPackIds(packsDir: string): string[] {
  if (!fs.existsSync(packsDir)) return [];
  return fs
    .readdirSync(packsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();
}

/**
 * Reads PACK_FILES from src/data/pack.ts: { packId: [file, ...] } in declaration order.
 * Returns null when the block can't be found (then callers fall back to FILE_SCHEMAS).
 */
export function readPackRegistry(packTsPath: string = PACK_TS): Map<string, string[]> | null {
  let src: string;
  try {
    src = fs.readFileSync(packTsPath, 'utf8');
  } catch {
    return null;
  }
  const decl = /PACK_FILES\s*=\s*\{/.exec(src);
  if (!decl) return null;
  // Walk to the matching closing brace.
  let depth = 0;
  let end = -1;
  for (let i = decl.index + decl[0].length - 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const body = src.slice(decl.index + decl[0].length, end);
  const registry = new Map<string, string[]>();
  const packRe = /['"]?([\w-]+)['"]?\s*:\s*\{([^{}]*)\}/g;
  for (let m = packRe.exec(body); m; m = packRe.exec(body)) {
    const id = m[1];
    const inner = m[2] ?? '';
    if (!id) continue;
    const files = [...inner.matchAll(/['"]([^'"]+\.json)['"]\s*:/g)].map((f) => f[1] ?? '').filter(Boolean);
    if (files.length) registry.set(id, files);
  }
  return registry.size ? registry : null;
}

/** Every JSON file inside a pack folder (recursive), relative with forward slashes, sorted. */
export function listPackJsonFiles(packDir: string): string[] {
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) visit(full);
      else if (d.isFile() && d.name.endsWith('.json')) out.push(path.relative(packDir, full).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(packDir)) visit(packDir);
  return out.sort();
}

/** Files manifest.json must checksum: every JSON file in the pack folder except the manifest itself. */
export function manifestCoveredFiles(packDir: string): string[] {
  return listPackJsonFiles(packDir).filter((f) => f !== 'manifest.json');
}

export function sha256File(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Files a pack must contain: its PACK_FILES entry, else the first registered pack's list, else FILE_SCHEMAS. */
export function packFilesFor(packId: string, registry: Map<string, string[]> | null): string[] {
  const own = registry?.get(packId);
  if (own) return own;
  const first = registry ? [...registry.values()][0] : undefined;
  return first ?? Object.keys(FILE_SCHEMAS);
}

// ---------------------------------------------------------------- JSON walking

export type JsonObject = { [key: string]: unknown };
export type PathSeg = string | { index: number; id?: string };

export function isPlainObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const LANG_KEY = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

/** A Localized value: { en: "...", es?: "...", ... } — every key a language tag, every value a string. */
export function isLocalized(v: unknown): v is Record<string, string> {
  if (!isPlainObject(v) || typeof v.en !== 'string') return false;
  return Object.entries(v).every(([k, val]) => LANG_KEY.test(k) && typeof val === 'string');
}

function segId(v: unknown): string | undefined {
  if (!isPlainObject(v)) return undefined;
  if (typeof v.id === 'string') return v.id;
  if (typeof v.key === 'string') return v.key;
  if (typeof v.year === 'number') return String(v.year);
  return undefined;
}

/** Depth-first walk over a parsed JSON value. Array items are labelled by their id/key/year when they have one. */
export function walk(
  value: unknown,
  visit: (value: unknown, path: readonly PathSeg[]) => void,
  at: PathSeg[] = [],
): void {
  visit(value, at);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...at, { index, id: segId(item) }]));
  } else if (isPlainObject(value)) {
    for (const [k, v] of Object.entries(value)) walk(v, visit, [...at, k]);
  }
}

/** `programs[bmspaf].description.es`, `years[2026].bySize[0]`, or `(root)`. */
export function formatPath(at: readonly PathSeg[]): string {
  let out = '';
  for (const seg of at) {
    if (typeof seg === 'string') out += out ? `.${seg}` : seg;
    else out += `[${seg.id ?? seg.index}]`;
  }
  return out || '(root)';
}

/** Last string segment of a path (the collection or field name). */
export function lastKey(at: readonly PathSeg[]): string | undefined {
  for (let i = at.length - 1; i >= 0; i--) {
    const seg = at[i];
    if (typeof seg === 'string') return seg;
  }
  return undefined;
}

export function parseWith<T>(schema: ZodType<T>, data: unknown): T | null {
  const r = schema.safeParse(data);
  return r.success ? r.data : null;
}

export function formatZodIssues(error: z.ZodError, max = 8): string[] {
  const lines = error.issues.slice(0, max).map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
  if (error.issues.length > max) lines.push(`…and ${error.issues.length - max} more`);
  return lines;
}
