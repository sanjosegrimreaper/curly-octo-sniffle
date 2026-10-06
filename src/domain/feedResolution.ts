/**
 * NADAC feed resolution: the bundled feed always works offline; a cached or freshly
 * fetched feed replaces it only when it is valid and newer.
 */
import { nadacFeedSchema, type NadacFeed } from '@/data/schemas';

import { parseISODate } from './dates';

/** Where the resolved feed came from. */
export type FeedSource = 'bundled' | 'cached' | 'remote';

/** The minimal fetch surface `fetchJson` needs (the global `fetch` satisfies it). */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Options for `fetchJson`. */
export type FetchJsonOptions = {
  /** Per-attempt timeout (default 6000 ms). */
  timeoutMs?: number;
  /** Extra attempts after the first (default 2). */
  retries?: number;
  /** Wait before retry n (0-based) is backoffMs × 2^n (default 500 ms). */
  backoffMs?: number;
  /** Injected fetch (defaults to the global `fetch`). */
  fetchImpl?: FetchLike;
};

/**
 * Validates unknown JSON as a NADAC feed (an impossible as-of date such as
 * 2026-02-30 is rejected too). Returns null instead of throwing.
 */
export function parseFeed(json: unknown): NadacFeed | null {
  try {
    const r = nadacFeedSchema.safeParse(json);
    if (!r.success) return null;
    return r.data.asOfDate === null || parseISODate(r.data.asOfDate) ? r.data : null;
  } catch {
    return null;
  }
}

/** Orders as-of dates; a feed that was never refreshed (null) is older than any dated one. */
function compareAsOf(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

const SOURCE_RANK: Record<FeedSource, number> = { remote: 0, cached: 1, bundled: 2 };

/**
 * Picks the feed to show. Cached and remote values are validated (invalid ones are
 * ignored); among valid feeds the newest `asOfDate` wins (null = never refreshed =
 * oldest) and ties prefer remote > cached > bundled. When `today` is given, feeds
 * dated after it are ignored too. The bundled feed is the fallback that always resolves.
 */
export function resolveFeed(input: { bundled: NadacFeed; cached?: unknown; remote?: unknown; today?: string }): {
  feed: NadacFeed;
  source: FeedSource;
} {
  const candidates: { feed: NadacFeed; source: FeedSource }[] = [{ feed: input.bundled, source: 'bundled' }];
  for (const source of ['cached', 'remote'] as const) {
    const feed = input[source] == null ? null : parseFeed(input[source]);
    const future = feed !== null && input.today !== undefined && compareAsOf(feed.asOfDate, input.today) > 0;
    if (feed && !future) candidates.push({ feed, source });
  }
  return candidates.reduce((best, c) => {
    const cmp = compareAsOf(c.feed.asOfDate, best.feed.asOfDate);
    return cmp > 0 || (cmp === 0 && SOURCE_RANK[c.source] < SOURCE_RANK[best.source]) ? c : best;
  });
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

/** Client errors that will not change on retry (408 timeout and 429 rate limit are retried). */
const isPermanent = (e: unknown) =>
  e instanceof HttpError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;

/**
 * Fetches and parses JSON with a per-attempt timeout (AbortController, plus a hard
 * timer in case the fetch ignores the signal) and exponential backoff between attempts.
 * Permanent 4xx errors are not retried. Resolves null on any failure; never throws.
 */
export async function fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown | null> {
  const { timeoutMs = 6000, retries = 2, backoffMs = 500 } = opts;
  const fetchImpl: FetchLike | undefined =
    opts.fetchImpl ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
  if (!fetchImpl) return null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(new Error('timeout'));
      }, timeoutMs);
    });
    try {
      const request = (async () => {
        const res = await fetchImpl(url, controller ? { signal: controller.signal } : undefined);
        if (!res.ok) throw new HttpError(res.status);
        return await res.json();
      })();
      request.catch(() => undefined); // a late rejection after the timeout must not go unhandled
      return await Promise.race([request, timeout]);
    } catch (e) {
      if (isPermanent(e)) return null;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(backoffMs * 2 ** attempt);
  }
  return null;
}
