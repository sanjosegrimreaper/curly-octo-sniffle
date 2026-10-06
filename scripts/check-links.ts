/**
 * Checks every https URL in data/packs and prints a Markdown report to stdout
 * (progress goes to stderr, so `> report.md` captures only the report).
 *
 *   npx tsx scripts/check-links.ts [--strict] [--packs-dir <dir>]
 *
 * Each URL: HEAD, then GET if HEAD fails or errors; 10 s timeout; 3 at a time; browser User-Agent.
 *   2xx/3xx            ok
 *   401/403/429        bot-protected — verify in a browser
 *   404/410            broken
 *   5xx / other        server error / other
 *   no response        network error
 *   proxy 403          blocked by network — this machine's egress policy refused the host;
 *                      not the site's answer (recognized by the proxy's x-deny-reason header)
 * It never edits data. With --strict, exit 1 only when a link is broken (404/410).
 */
import { color, listFiles, parseArgs, readJsonFile, rel, run, todayLocal } from './lib/cli';
import { BROWSER_UA, describeFetchError, isProxyBlock } from './lib/http';
import { formatPath, resolvePacksDir, walk } from './lib/packs';

const TIMEOUT_MS = 10_000;
const CONCURRENCY = 3;
const MAX_REFS_SHOWN = 3;

type Category = 'broken' | 'bot-protected' | 'blocked' | 'network' | 'server' | 'other' | 'ok';
type Ref = { file: string; path: string };
type Result = {
  url: string;
  refs: Ref[];
  category: Category;
  status?: number;
  method: 'HEAD' | 'GET';
  detail?: string;
};
type Probe =
  | { kind: 'response'; status: number; blocked: boolean; redirected: string | null }
  | { kind: 'error'; message: string; blocked: boolean };

const SECTIONS: readonly { category: Category; title: string; blurb: string }[] = [
  {
    category: 'broken',
    title: 'Broken (404/410)',
    blurb: 'The page is gone. Find the new official page, or remove the fact and list it in unverified.json.',
  },
  {
    category: 'bot-protected',
    title: 'Bot-protected (401/403/429) — verify in a browser',
    blurb: 'The site refused an automated check. Open each link in a browser; if it loads, it is fine.',
  },
  {
    category: 'blocked',
    title: 'Blocked by network (proxy 403) — not checked',
    blurb:
      "This machine's network policy refused these hosts, so they were not checked. Run in GitHub Actions or open them in a browser.",
  },
  {
    category: 'network',
    title: 'Network errors',
    blurb: 'No answer (DNS, TLS, timeout). Often temporary; re-run before acting.',
  },
  {
    category: 'server',
    title: 'Server errors (5xx)',
    blurb: 'The site had a problem. Often temporary; re-run before acting.',
  },
  { category: 'other', title: 'Other HTTP answers', blurb: 'Unexpected status codes worth a look.' },
];

async function probe(url: string, method: 'HEAD' | 'GET'): Promise<Probe> {
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: {
        'user-agent': BROWSER_UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel().catch(() => undefined);
    return {
      kind: 'response',
      status: res.status,
      blocked: isProxyBlock(res),
      redirected: res.redirected ? res.url : null,
    };
  } catch (e) {
    const d = describeFetchError(e);
    return { kind: 'error', message: d.message, blocked: d.blocked };
  }
}

function classify(status: number): Category {
  if (status >= 200 && status < 400) return 'ok';
  if (status === 401 || status === 403 || status === 429) return 'bot-protected';
  if (status === 404 || status === 410) return 'broken';
  if (status >= 500) return 'server';
  return 'other';
}

async function check(url: string, refs: Ref[]): Promise<Result> {
  let method: 'HEAD' | 'GET' = 'HEAD';
  let p = await probe(url, 'HEAD');
  const headFailed = p.kind === 'error' || p.status >= 400;
  if (headFailed && !p.blocked) {
    method = 'GET';
    p = await probe(url, 'GET');
  }
  if (p.blocked) return { url, refs, method, category: 'blocked', detail: 'egress proxy refused the host' };
  if (p.kind === 'error') return { url, refs, method, category: 'network', detail: p.message };
  return {
    url,
    refs,
    method,
    status: p.status,
    category: classify(p.status),
    detail: p.redirected && p.redirected !== url ? `→ ${p.redirected}` : undefined,
  };
}

async function pool<T, R>(items: readonly T[], size: number, work: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      if (item !== undefined) out[i] = await work(item, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

const md = (s: string) => s.replace(/\|/g, '\\|');
const where = (refs: readonly Ref[]) =>
  refs
    .slice(0, MAX_REFS_SHOWN)
    .map((r) => `\`${r.file}\` ${md(r.path)}`)
    .join('<br>') + (refs.length > MAX_REFS_SHOWN ? `<br>…and ${refs.length - MAX_REFS_SHOWN} more` : '');

function report(results: readonly Result[], refsTotal: number, packsDir: string): string {
  const count = (c: Category) => results.filter((r) => r.category === c).length;
  const lines: string[] = [
    `# Link check — ${todayLocal()}`,
    '',
    `Checked ${results.length} unique https URLs (${refsTotal} references) in \`${rel(packsDir)}/\`. HEAD then GET, ${TIMEOUT_MS / 1000}s timeout, browser User-Agent. This report never changes data.`,
    '',
    '| Result | Count |',
    '| --- | --- |',
    `| OK (2xx/3xx) | ${count('ok')} |`,
    ...SECTIONS.map((s) => `| ${s.title} | ${count(s.category)} |`),
    '',
  ];
  for (const s of SECTIONS) {
    const rows = results.filter((r) => r.category === s.category);
    if (!rows.length) continue;
    lines.push(`## ${s.title}`, '', s.blurb, '', '| URL | Answer | Used in |', '| --- | --- | --- |');
    for (const r of rows) {
      const answer = r.status !== undefined ? `${r.method} ${r.status}` : `${r.method}: ${r.detail ?? ''}`;
      lines.push(`| ${md(r.url)} | ${md(answer)} | ${where(r.refs)} |`);
    }
    lines.push('');
  }
  const ok = results.filter((r) => r.category === 'ok');
  if (ok.length) {
    lines.push(`<details><summary>OK (${ok.length})</summary>`, '', '| URL | Answer |', '| --- | --- |');
    for (const r of ok)
      lines.push(`| ${md(r.url)} | ${r.method} ${r.status ?? ''}${r.detail ? ` ${md(r.detail)}` : ''} |`);
    lines.push('', '</details>', '');
  }
  return lines.join('\n');
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), ['packs-dir']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const strict = args.has('strict');

  const byUrl = new Map<string, Ref[]>();
  let refsTotal = 0;
  for (const file of listFiles(packsDir, (n) => n.endsWith('.json'))) {
    const r = readJsonFile(file);
    if (!r.ok) {
      console.error(color.red(`✖ ${r.error}`));
      return 1;
    }
    walk(r.json, (value, at) => {
      if (typeof value !== 'string' || !value.startsWith('https://')) return;
      refsTotal++;
      byUrl.set(value, [...(byUrl.get(value) ?? []), { file: rel(file), path: formatPath(at) }]);
    });
  }

  if (!byUrl.size) {
    console.log(`# Link check — ${todayLocal()}\n\nNo https URLs found in \`${rel(packsDir)}/\`.`);
    return 0;
  }

  const urls = [...byUrl.keys()];
  console.error(color.dim(`Checking ${urls.length} URLs, ${CONCURRENCY} at a time…`));
  let done = 0;
  const results = await pool(urls, CONCURRENCY, async (url) => {
    const r = await check(url, byUrl.get(url) ?? []);
    done++;
    const paint = r.category === 'ok' ? color.green : r.category === 'broken' ? color.red : color.yellow;
    console.error(`${color.dim(`[${done}/${urls.length}]`)} ${paint(r.category.padEnd(13))} ${r.status ?? ''} ${url}`);
    return r;
  });

  console.log(report(results, refsTotal, packsDir));

  const broken = results.filter((r) => r.category === 'broken').length;
  const blocked = results.filter((r) => r.category === 'blocked').length;
  if (blocked) console.error(color.yellow(`${blocked} URL(s) were blocked by this machine's network and not checked.`));
  if (broken) console.error(color.red(`${broken} broken link(s) (404/410).`));
  return strict && broken ? 1 : 0;
}

run(main);
