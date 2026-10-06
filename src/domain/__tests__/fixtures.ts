/**
 * FAKE fixture data for domain tests. Nothing here is a real fact: guideline amounts
 * follow an obviously made-up pattern, programs are "Test Program N", prices are
 * invented and every URL is on example.org. Medicine names exist only so search can
 * be tested with real-world spellings; every other field about them is fake.
 */
import type {
  BenefitRule,
  CostPlusSnapshot,
  FplTable,
  FplYear,
  Localized,
  Medication,
  NadacEntry,
  NadacFeed,
  Outlook,
  Program,
  SourceRef,
  Strength,
} from '@/data/schemas';
import type { ScreenerValues } from '@/state/screener';

import type { Profile } from '../eligibility';

export const FAKE_SOURCES: SourceRef[] = [
  { name: 'Test Source (fake)', url: 'https://example.org/source', method: 'official-pdf', checkedOn: '2026-01-15' },
];

const L = (en: string): Localized => ({ en });

/** Guideline for size n = base + step × (n − 1); step is also the per-additional amount. */
function fplRow(year: number, base: number, step: number): FplYear {
  return {
    year,
    bySize: Array.from({ length: 8 }, (_, i) => base + step * i),
    perAdditional: step,
    effectiveDate: `${year}-01-15`,
    sources: FAKE_SOURCES,
    verifiedAsOf: '2026-01-15',
  };
}

/** 2025: 10000 + 5000(n−1). 2026: 12000 + 6000(n−1). */
export const FPL: FplTable = { years: [fplRow(2025, 10000, 5000), fplRow(2026, 12000, 6000)] };

export function makeRule(overrides: Partial<BenefitRule> & Pick<BenefitRule, 'id'>): BenefitRule {
  return {
    programKey: 'standard',
    title: L('Test Rule'),
    summary: L('A fake rule for tests.'),
    when: { all: [] },
    fplYear: 2026,
    tier: 'mayQualify',
    links: [],
    nextSteps: [],
    sources: FAKE_SOURCES,
    verifiedAsOf: '2026-01-15',
    ...overrides,
  };
}

export const RULES: BenefitRule[] = [
  makeRule({
    id: 'test-coverage-a',
    programKey: 'medi-cal',
    when: { all: [{ insurance: ['none', 'unsure'] }, { incomePctFplMax: 150 }] },
  }),
  makeRule({
    id: 'test-coverage-b',
    programKey: 'covered-california',
    when: { all: [{ insurance: ['none', 'unsure', 'private'] }, { incomePctFplMin: 150 }, { incomePctFplMax: 300 }] },
  }),
  makeRule({ id: 'test-senior', programKey: 'medicare', when: { all: [{ age65: 'yes' }] }, tier: 'worthChecking' }),
  makeRule({ id: 'test-county', programKey: 'county', when: { all: [{ county: ['test-county-a'] }] } }),
  makeRule({ id: 'test-standard', programKey: 'standard', when: { all: [] }, fplYear: null, tier: 'worthChecking' }),
];

export function makeProgram(overrides: Partial<Program> & Pick<Program, 'id'>): Program {
  return {
    kind: 'manufacturerPap',
    name: `Test Program ${overrides.id}`,
    sponsor: 'Test Sponsor',
    description: L('A fake program for tests.'),
    medicationIds: ['test-med-brand'],
    fplMax: 400,
    fplYear: 2026,
    insuranceRule: 'uninsuredOnly',
    insuranceRuleText: L('Fake insurance rule.'),
    closedToNew: false,
    applicationUrl: 'https://example.org/apply',
    phone: null,
    interpreterAvailable: null,
    documents: [],
    sendWhere: null,
    termMonths: 12,
    cutoffNote: null,
    sources: FAKE_SOURCES,
    verifiedAsOf: '2026-01-15',
    ...overrides,
  };
}

export const PROGRAMS: Program[] = [
  makeProgram({ id: 'p-under', fplMax: 400 }),
  makeProgram({ id: 'p-unpublished', fplMax: null, fplYear: null }),
  makeProgram({ id: 'p-low-cap', fplMax: 120 }),
  makeProgram({ id: 'p-closed', closedToNew: true }),
  makeProgram({ id: 'p-commercial', insuranceRule: 'commercialOnly' }),
  makeProgram({ id: 'p-other-drug', medicationIds: ['some-other-med'] }),
];

export function makeStrength(overrides: Partial<Strength> = {}): Strength {
  return {
    id: 's-tab',
    label: L('1 mg (fake)'),
    form: 'tablet',
    pricingUnit: 'EA',
    unitsPerCount: 1,
    countLabel: L('tablet'),
    quantities: [30, 60, 90],
    defaultQuantity: 30,
    daysPerCount: 1,
    costPlusUrl: 'https://example.org/costplus/test',
    nadacKey: 'test-key-tab',
    ...overrides,
  };
}

export const PEN_STRENGTH = makeStrength({
  id: 's-pen',
  form: 'pen',
  pricingUnit: 'ML',
  unitsPerCount: 15,
  quantities: [1],
  defaultQuantity: 1,
  daysPerCount: null,
  nadacKey: 'test-key-pen',
});

export function makeMedication(overrides: Partial<Medication> & Pick<Medication, 'id' | 'generic'>): Medication {
  return {
    brand: null,
    displayName: L(overrides.generic),
    aliases: {},
    category: 'other',
    marketStatus: 'genericAvailable',
    kind: 'small-molecule',
    strengths: [makeStrength()],
    goodRxUrl: 'https://example.org/coupon',
    singleCareUrl: 'https://example.org/coupon2',
    programIds: [],
    hasManufacturerPap: false,
    common: true,
    notes: [],
    sources: FAKE_SOURCES,
    verifiedAsOf: '2026-01-15',
    ...overrides,
  };
}

export const MEDICATIONS: Medication[] = [
  makeMedication({
    id: 'test-metformin',
    generic: 'metformin',
    displayName: { en: 'Metformin', es: 'Metformina', 'zh-Hans': '二甲双胍', hi: 'मेटफॉर्मिन' },
    aliases: { es: ['metformina'], 'zh-Hans': ['二甲双胍'], hi: ['मेटफॉर्मिन'] },
  }),
  makeMedication({ id: 'test-med-brand', brand: 'Eliquis', generic: 'apixaban', displayName: L('Eliquis') }),
  makeMedication({
    id: 'test-glargine',
    generic: 'insulin glargine',
    displayName: L('Insulin glargine'),
    strengths: [PEN_STRENGTH],
  }),
  makeMedication({ id: 'test-atorvastatin', generic: 'atorvastatin', displayName: L('Atorvastatin') }),
  makeMedication({ id: 'test-accented', generic: 'testazol', displayName: L('Tëstàzol (fake)') }),
];

export function nadacEntry(overrides: Partial<NadacEntry> = {}): NadacEntry {
  return {
    key: 'test-key-tab',
    ndcDescription: 'TEST TABLET (FAKE)',
    ndc: '00000000000',
    perUnit: 0.5,
    pricingUnit: 'EA',
    effectiveDate: '2026-01-07',
    ...overrides,
  };
}

export function makeFeed(asOfDate: string | null, entries: NadacEntry[] = [nadacEntry()]): NadacFeed {
  return { asOfDate, datasetId: 'test-dataset', entries, sources: FAKE_SOURCES, verifiedAsOf: '2026-01-15' };
}

export const COST_PLUS: CostPlusSnapshot = {
  snapshotDate: '2026-01-10',
  formula: {
    markupPercent: 10,
    pharmacyFeeCents: 100,
    shippingCents: null,
    sources: FAKE_SOURCES,
    verifiedAsOf: '2026-01-15',
  },
  quotes: [
    {
      medicationId: 'test-metformin',
      strengthId: 's-tab',
      quantity: 90,
      priceCents: 999,
      productName: 'Test 1',
      url: 'https://example.org/q90',
    },
    {
      medicationId: 'test-metformin',
      strengthId: 's-tab',
      quantity: 30,
      priceCents: 500,
      productName: 'Test 1',
      url: 'https://example.org/q30',
    },
    {
      medicationId: 'test-metformin',
      strengthId: 's-other',
      quantity: 30,
      priceCents: 700,
      productName: 'Test 2',
      url: 'https://example.org/q30b',
    },
  ],
  notListed: [
    { medicationId: 'test-med-brand', strengthId: null },
    { medicationId: 'test-glargine', strengthId: 's-pen-2' },
  ],
  sources: FAKE_SOURCES,
  verifiedAsOf: '2026-01-15',
};

export function makeOutlook(overrides: Partial<Outlook> = {}): Outlook {
  return {
    medicationId: 'test-med-brand',
    kind: 'prediction',
    earliestDate: '2027-01-01',
    label: 'TEST-0000',
    basis: L('Fake basis.'),
    sources: FAKE_SOURCES,
    verifiedAsOf: '2026-01-15',
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { insurance: 'none', age65: null, county: null, householdSize: 1, income: null, ...overrides };
}

/** Cast so that fields other engineers add to the screener later do not break these fixtures. */
export function makeScreener(overrides: Partial<ScreenerValues> = {}): ScreenerValues {
  const base = {
    coverage: null,
    coverageType: null,
    age65: null,
    county: null,
    householdSize: null,
    incomeUnit: 'year',
    income: null,
    copayCents: null,
    checklist: {},
    lastRoute: null,
    completedAt: null,
    skipped: false,
  };
  return { ...base, ...overrides } as ScreenerValues;
}
