/**
 * HTTP helpers for the network scripts (check-links, refresh-nadac, snapshot-costplus).
 *
 * Network trouble — offline, DNS, timeouts, 5xx/429, or an egress proxy refusing the host —
 * is a NetworkError, so the weekly jobs can skip cleanly instead of failing. A sandbox egress
 * proxy that refuses a host answers 403 with an `x-deny-reason` header (or fails the CONNECT);
 * that is reported as "blocked by network", never confused with the site's own 403.
 */
import { errorMessage } from './cli';

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
export const SCRIPT_UA = 'RxBridge-data-refresh/1.0 (+https://github.com/sanjosegrimreaper/curly-octo-sniffle)';

export class NetworkError extends Error {
  constructor(
    message: string,
    readonly blocked: boolean = false,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** True when the response is the sandbox egress proxy refusing the host (not the site itself). */
export function isProxyBlock(res: Response): boolean {
  return res.status === 403 && res.headers.has('x-deny-reason');
}

/** Describes a fetch() rejection; `blocked` when a proxy refused the tunnel. */
export function describeFetchError(e: unknown): { message: string; blocked: boolean; timeout: boolean } {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause = err.cause instanceof Error ? err.cause : undefined;
  const causeCode = cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
  const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
  const text = `${err.message} ${cause?.message ?? ''}`;
  const blocked = /tunnel|proxy/i.test(text) && /403|forbidden|denied/i.test(text);
  const detail = timeout ? 'timed out' : (causeCode ?? cause?.message ?? err.message);
  return { message: detail, blocked, timeout };
}

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type FetchJsonOptions = {
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
};

/**
 * GET a JSON document. Retries network errors, 429 and 5xx with backoff.
 * Throws NetworkError for network trouble (incl. proxy blocks), HttpError for other non-2xx
 * answers or a body that is not JSON.
 */
export async function fetchJson(url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
  const { timeoutMs = 30_000, retries = 2, userAgent = SCRIPT_UA } = opts;
  let last: Error = new NetworkError(`no attempt made for ${host(url)}`);
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const d = describeFetchError(e);
      if (d.blocked) throw new NetworkError(`${host(url)} is blocked by the network (proxy 403)`, true);
      last = new NetworkError(`network error reaching ${host(url)}: ${d.message}`);
      continue;
    }
    if (isProxyBlock(res)) {
      const reason = res.headers.get('x-deny-reason') ?? 'denied';
      throw new NetworkError(`${host(url)} is blocked by the network (proxy 403: ${reason})`, true);
    }
    if (res.status === 429 || res.status >= 500) {
      last = new NetworkError(`${host(url)} answered HTTP ${res.status}`);
      await res.body?.cancel();
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new HttpError(`${host(url)} answered HTTP ${res.status} for ${url}`, res.status);
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      throw new HttpError(`${host(url)} did not return JSON (${errorMessage(e)}): ${text.slice(0, 120)}`, res.status);
    }
  }
  throw last;
}
