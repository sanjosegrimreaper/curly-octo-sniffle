/**
 * The screener's routes and the Bridge steps on each path.
 *
 * - No / Not sure path: Coverage → Where → Age → Household → Income → Result (6 steps)
 * - Insured path:       Coverage → Kind of coverage → Checklist | Medi-Cal (3 steps)
 *
 * The Coverage screen belongs to both; its "of M" follows the current answer, so the
 * total changes as soon as the person picks Yes or No.
 */
import type { Href } from 'expo-router';

import type { CoverageAnswer } from '@/state/screener';

export const ROUTES = {
  welcome: '/welcome',
  coverage: '/onboarding/coverage',
  coverageType: '/onboarding/coverage-type',
  checklist: '/onboarding/checklist',
  mediCal: '/onboarding/medi-cal',
  county: '/onboarding/county',
  age: '/onboarding/age',
  household: '/onboarding/household',
  income: '/onboarding/income',
  result: '/onboarding/result',
  /** Routes owned by other screens. */
  find: '/find',
  home: '/home',
  medicareFromOnboarding: '/medicare?from=onboarding',
} as const;

export type ScreenerRoute = Exclude<
  (typeof ROUTES)[keyof typeof ROUTES],
  '/welcome' | '/find' | '/home' | '/medicare?from=onboarding'
>;

/** Step names (i18n keys under `steps.`). */
export type StepName =
  'coverage' | 'coverageType' | 'where' | 'age' | 'household' | 'income' | 'result' | 'checklist' | 'mediCal';

export const UNINSURED_PATH: readonly ScreenerRoute[] = [
  ROUTES.coverage,
  ROUTES.county,
  ROUTES.age,
  ROUTES.household,
  ROUTES.income,
  ROUTES.result,
];
/** The last insured step is either the checklist or the Medi-Cal screen (same position). */
export const INSURED_PATH: readonly ScreenerRoute[] = [ROUTES.coverage, ROUTES.coverageType, ROUTES.checklist];

const NAME: Record<ScreenerRoute, StepName> = {
  '/onboarding/coverage': 'coverage',
  '/onboarding/coverage-type': 'coverageType',
  '/onboarding/checklist': 'checklist',
  '/onboarding/medi-cal': 'mediCal',
  '/onboarding/county': 'where',
  '/onboarding/age': 'age',
  '/onboarding/household': 'household',
  '/onboarding/income': 'income',
  '/onboarding/result': 'result',
};

const INSURED_ONLY: readonly ScreenerRoute[] = [ROUTES.coverageType, ROUTES.checklist, ROUTES.mediCal];

/** Which path a route is on. The Coverage screen follows the answer (no answer yet → the longer path). */
export function pathFor(route: ScreenerRoute, coverage: CoverageAnswer | null): readonly ScreenerRoute[] {
  if (INSURED_ONLY.includes(route)) return INSURED_PATH;
  if (route === ROUTES.coverage && coverage === 'yes') return INSURED_PATH;
  return UNINSURED_PATH;
}

/** "Step `now` of `total`" for a route, given the coverage answer. */
export function stepFor(
  route: ScreenerRoute,
  coverage: CoverageAnswer | null,
): { now: number; total: number; name: StepName } {
  const path = pathFor(route, coverage);
  const position = route === ROUTES.mediCal ? path.indexOf(ROUTES.checklist) : path.indexOf(route);
  return { now: Math.max(0, position) + 1, total: path.length, name: NAME[route] };
}

/**
 * Where the back button goes when there is no history to pop (e.g. the app restarted and
 * resumed mid-screener). Without this, "back" would bounce to the index redirect and land
 * on the same screen again.
 */
export const PREVIOUS_ROUTE: Record<ScreenerRoute, string> = {
  '/onboarding/coverage': ROUTES.welcome,
  '/onboarding/coverage-type': ROUTES.coverage,
  '/onboarding/checklist': ROUTES.coverageType,
  '/onboarding/medi-cal': ROUTES.coverageType,
  '/onboarding/county': ROUTES.coverage,
  '/onboarding/age': ROUTES.county,
  '/onboarding/household': ROUTES.age,
  '/onboarding/income': ROUTES.household,
  '/onboarding/result': ROUTES.income,
};

/** Typed-routes escape hatch for routes built by other screens (they may not exist yet at type-gen time). */
export function href(path: string): Href {
  return path as Href;
}
