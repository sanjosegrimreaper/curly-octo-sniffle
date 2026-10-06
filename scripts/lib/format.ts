/**
 * Writes generated files the way `npm run format` (Prettier) would, so running the
 * formatter later never changes them (which would invalidate manifest checksums or
 * make `gen-verification --check` fail).
 */
import fs from 'node:fs';

import * as prettier from 'prettier';

async function pretty(text: string, file: string, parser: 'json' | 'markdown'): Promise<string> {
  const config = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(text, { ...config, parser, filepath: file });
}

export async function formatJson(value: unknown, file: string): Promise<string> {
  return pretty(JSON.stringify(value, null, 2) + '\n', file, 'json');
}

export async function formatMarkdown(markdown: string, file: string): Promise<string> {
  return pretty(markdown, file, 'markdown');
}

/** Atomic write: a crash mid-write never leaves a half-written file behind. */
export function writeFileAtomic(file: string, contents: string): void {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}
