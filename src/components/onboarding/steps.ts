/**
 * The screener's routes and how they map onto the five Bridge steps
 * (Coverage → Where → Household → Income → Result).
 */
import type { Href } from 'expo-router';

export const SCREENER_STEPS = ['coverage', 'where', 'household', 'income', 'result'] as const;
export type ScreenerStep = (typeof SCREENER_STEPS)[number];
export const TOTAL_STEPS = SCREENER_STEPS.length;

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

/** 1-based Bridge step for each screener route. Insured branches end on the last step. */
export const STEP_OF_ROUTE: Record<ScreenerRoute, number> = {
  '/onboarding/coverage': 1,
  '/onboarding/coverage-type': 1,
  '/onboarding/county': 2,
  '/onboarding/age': 3,
  '/onboarding/household': 3,
  '/onboarding/income': 4,
  '/onboarding/result': 5,
  '/onboarding/checklist': 5,
  '/onboarding/medi-cal': 5,
};

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
