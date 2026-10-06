import type { Helper, InsuranceStatus } from '@/data/schemas';
import type { Profile } from '@/domain';

/**
 * Who a helper is likely relevant to, from the screener answers. Unknown answers keep
 * everything relevant (we never hide help because we lack an answer).
 */
export function relevantAudiences(profile: Pick<Profile, 'insurance' | 'age65'>, screenerDone: boolean): Set<Helper['forWhom']> {
  if (!screenerDone) return new Set(['everyone', 'medicare', 'uninsured', 'covered-california', 'medi-cal']);
  const out = new Set<Helper['forWhom']>(['everyone']);
  const ins: InsuranceStatus = profile.insurance;
  if (ins === 'medicare' || profile.age65 === 'yes') out.add('medicare');
  if (ins === 'none' || ins === 'unsure') {
    out.add('uninsured');
    out.add('covered-california');
    out.add('medi-cal');
  }
  if (ins === 'private' || ins === 'other') out.add('covered-california');
  if (ins === 'medi-cal') out.add('medi-cal');
  return out;
}

/** True when the helper serves this county (an empty list means the whole region). */
export function servesCounty(helper: Pick<Helper, 'counties'>, county: string | null): boolean {
  if (helper.counties.length === 0) return true;
  if (!county || county === 'other') return true;
  return helper.counties.includes(county);
}

/** Helpers for the person's county, split into "may fit you" and "also available". */
export function splitHelpers(
  helpers: readonly Helper[],
  county: string | null,
  audiences: ReadonlySet<Helper['forWhom']>,
): { forYou: Helper[]; others: Helper[] } {
  const inCounty = helpers.filter((h) => servesCounty(h, county));
  return {
    forYou: inCounty.filter((h) => audiences.has(h.forWhom)),
    others: inCounty.filter((h) => !audiences.has(h.forWhom)),
  };
}
