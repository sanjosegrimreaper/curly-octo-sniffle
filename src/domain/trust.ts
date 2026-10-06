/**
 * Source trust. A fact counts as confirmed only when every source behind it was
 * checked on the official source; anything 'unconfirmed' is labeled "Not yet
 * confirmed — call to confirm".
 */
import { CONFIRMED_METHODS, type SourceRef } from '@/data/schemas';

/**
 * True iff there is at least one source and every source's method is one of
 * `CONFIRMED_METHODS`. No sources means nothing is confirmed.
 */
export function isConfirmed(sources: readonly Pick<SourceRef, 'method'>[]): boolean {
  return sources.length > 0 && sources.every((s) => CONFIRMED_METHODS.includes(s.method));
}
