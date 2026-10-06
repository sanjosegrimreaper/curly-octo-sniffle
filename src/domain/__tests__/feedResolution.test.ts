import * as fc from 'fast-check';

import { fetchJson, parseFeed, resolveFeed, type FetchLike } from '../feedResolution';
import { makeFeed } from './fixtures';

describe('parseFeed', () => {
  it('accepts a valid feed (and the empty pre-refresh feed)', () => {
    const feed = makeFeed('2026-01-10');
    expect(parseFeed(JSON.parse(JSON.stringify(feed)))).toEqual(feed);
    expect(parseFeed(makeFeed(null, []))).toEqual(makeFeed(null, []));
  });

  it('returns null for anything invalid, without throwing', () => {
    expect(parseFeed(null)).toBeNull();
    expect(parseFeed(undefined)).toBeNull();
    expect(parseFeed('feed')).toBeNull();
    expect(parseFeed({})).toBeNull();
    expect(parseFeed({ ...makeFeed('2026-01-10'), entries: [{ key: 1 }] })).toBeNull();
    expect(parseFeed({ ...makeFeed('2026-01-10'), sources: [] })).toBeNull();
    expect(parseFeed(makeFeed('2026-02-30'))).toBeNull();
    expect(parseFeed(makeFeed('10/01/2026'))).toBeNull();
    const hostile = {
      get asOfDate(): string {
        throw new Error('boom');
      },
    };
    expect(() => parseFeed(hostile)).not.toThrow();
    expect(parseFeed(hostile)).toBeNull();
  });
});

describe('resolveFeed', () => {
  const bundled = makeFeed('2026-01-01');

  it('falls back to bundled', () => {
    expect(resolveFeed({ bundled }).source).toBe('bundled');
    expect(resolveFeed({ bundled, cached: null, remote: null }).source).toBe('bundled');
  });

  it('newest wins', () => {
    expect(resolveFeed({ bundled, cached: makeFeed('2026-02-01') }).source).toBe('cached');
    expect(resolveFeed({ bundled, cached: makeFeed('2026-02-01'), remote: makeFeed('2026-03-01') }).source).toBe(
      'remote',
    );
    expect(resolveFeed({ bundled, cached: makeFeed('2026-03-01'), remote: makeFeed('2026-02-01') }).source).toBe(
      'cached',
    );
    expect(resolveFeed({ bundled: makeFeed('2026-04-01'), cached: makeFeed('2026-03-01') }).source).toBe('bundled');
  });

  it('ties prefer remote > cached > bundled', () => {
    const same = makeFeed('2026-01-01');
    expect(resolveFeed({ bundled, cached: same, remote: same }).source).toBe('remote');
    expect(resolveFeed({ bundled, cached: same }).source).toBe('cached');
  });

  it('ignores an invalid remote or cached feed', () => {
    const r = resolveFeed({ bundled, cached: makeFeed('2026-02-01'), remote: { asOfDate: '2099-01-01' } });
    expect(r.source).toBe('cached');
    expect(resolveFeed({ bundled, cached: 'garbage', remote: 42 }).source).toBe('bundled');
  });

  it('treats a never-refreshed (null) as-of date as oldest', () => {
    expect(resolveFeed({ bundled, remote: makeFeed(null, []) }).source).toBe('bundled');
    expect(resolveFeed({ bundled: makeFeed(null, []), cached: makeFeed('2020-01-01') }).source).toBe('cached');
    expect(resolveFeed({ bundled: makeFeed(null, []), remote: makeFeed(null, []) }).source).toBe('remote');
  });

  it('ignores feeds dated after today when today is given', () => {
    expect(resolveFeed({ bundled, remote: makeFeed('2026-12-01'), today: '2026-10-06' }).source).toBe('bundled');
    expect(resolveFeed({ bundled, remote: makeFeed('2026-10-06'), today: '2026-10-06' }).source).toBe('remote');
  });

  it('returns the newest valid as-of date (property)', () => {
    const date = fc.option(
      fc
        .integer({ min: 0, max: 3000 })
        .map((n) => new Date(Date.UTC(2020, 0, 1) + n * 86400000).toISOString().slice(0, 10)),
    );
    const maybeInvalid = fc.oneof(
      date.map((d) => ({ valid: true, value: makeFeed(d) as unknown })),
      fc.constant({ valid: false, value: { junk: true } as unknown }),
    );
    fc.assert(
      fc.property(date, maybeInvalid, maybeInvalid, (b, c, r) => {
        const result = resolveFeed({ bundled: makeFeed(b), cached: c.value, remote: r.value });
        const dates = [
          b,
          ...(c.valid ? [(c.value as { asOfDate: string | null }).asOfDate] : []),
          ...(r.valid ? [(r.value as { asOfDate: string | null }).asOfDate] : []),
        ];
        const newest = dates.reduce<string | null>((m, d) => (d !== null && (m === null || d > m) ? d : m), null);
        expect(result.feed.asOfDate).toBe(newest);
      }),
    );
  });
});

describe('fetchJson', () => {
  type Res = Awaited<ReturnType<FetchLike>>;
  const ok = (body: unknown): Res => ({ ok: true, status: 200, json: async () => body });
  const status = (s: number): Res => ({ ok: false, status: s, json: async () => ({}) });
  const fast = { timeoutMs: 50, backoffMs: 1 };

  it('returns parsed JSON on success', async () => {
    const f = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => ok({ a: 1 }));
    await expect(fetchJson('https://example.org/feed.json', { ...fast, fetchImpl: f })).resolves.toEqual({ a: 1 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]?.[0]).toBe('https://example.org/feed.json');
    expect(f.mock.calls[0]?.[1]?.signal).toBeDefined();
  });

  it('retries server errors and network failures, then succeeds', async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n += 1;
      if (n === 1) return status(503);
      if (n === 2) throw new TypeError('Network request failed');
      return ok('third time');
    };
    await expect(fetchJson('u', { ...fast, retries: 2, fetchImpl: f })).resolves.toBe('third time');
    expect(n).toBe(3);
  });

  it('gives up after retries + 1 attempts and resolves null', async () => {
    const f = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => status(500));
    await expect(fetchJson('u', { ...fast, retries: 2, fetchImpl: f })).resolves.toBeNull();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('does not retry permanent client errors, but retries 408 and 429', async () => {
    const f404 = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => status(404));
    await expect(fetchJson('u', { ...fast, fetchImpl: f404 })).resolves.toBeNull();
    expect(f404).toHaveBeenCalledTimes(1);
    const f429 = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => status(429));
    await expect(fetchJson('u', { ...fast, retries: 1, fetchImpl: f429 })).resolves.toBeNull();
    expect(f429).toHaveBeenCalledTimes(2);
  });

  it('times out each attempt and aborts the request', async () => {
    const signals: AbortSignal[] = [];
    const f: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        if (init?.signal) signals.push(init.signal);
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const started = Date.now();
    await expect(fetchJson('u', { timeoutMs: 30, retries: 1, backoffMs: 1, fetchImpl: f })).resolves.toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('still times out when the fetch ignores the abort signal', async () => {
    const f: FetchLike = () => new Promise(() => undefined);
    await expect(fetchJson('u', { timeoutMs: 20, retries: 0, fetchImpl: f })).resolves.toBeNull();
  });

  it('times out a body that never finishes', async () => {
    const f: FetchLike = async () => ({ ok: true, status: 200, json: () => new Promise(() => undefined) });
    await expect(fetchJson('u', { timeoutMs: 20, retries: 0, fetchImpl: f })).resolves.toBeNull();
  });

  it('backs off exponentially between attempts', async () => {
    const times: number[] = [];
    const f: FetchLike = async () => {
      times.push(Date.now());
      return status(500);
    };
    await fetchJson('u', { timeoutMs: 1000, retries: 2, backoffMs: 40, fetchImpl: f });
    expect(times).toHaveLength(3);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(35);
    expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(75);
  });

  it('never throws: bad JSON, synchronous throws, missing fetch', async () => {
    const badJson: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });
    await expect(fetchJson('u', { ...fast, retries: 0, fetchImpl: badJson })).resolves.toBeNull();
    const sync: FetchLike = () => {
      throw new Error('sync');
    };
    await expect(fetchJson('u', { ...fast, retries: 0, fetchImpl: sync })).resolves.toBeNull();
    const original = globalThis.fetch;
    // @ts-expect-error simulate an environment without fetch
    delete globalThis.fetch;
    try {
      await expect(fetchJson('u', { ...fast, retries: 0 })).resolves.toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});
