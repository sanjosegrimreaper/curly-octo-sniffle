/**
 * Data-pack schemas. Every pack file is validated with these at build time
 * (scripts/validate-packs.ts) and again at load time (src/data/pack.ts).
 *
 * The Honesty Contract lives here: every fact-bearing record must carry
 * `sources` (at least one) and `verifiedAsOf`.
 */
import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export type ISODate = z.infer<typeof isoDate>;

export const verificationMethod = z.enum([
  'http-200',
  'browser-confirmed',
  'official-data-file',
  'official-pdf',
  'official-api',
  'phone-confirmed',
  /**
   * Not yet confirmed on the official page (e.g. seen only in a web-search result from the source's
   * own domain, or the official page could not be opened). Say which in `note`.
   * Allowed in a 'draft' pack only. The app labels such facts "Not yet confirmed — call to confirm".
   */
  'unconfirmed',
]);

/** Methods that count as confirmed on the official source. */
export const CONFIRMED_METHODS: readonly VerificationMethodName[] = [
  'http-200',
  'browser-confirmed',
  'official-data-file',
  'official-pdf',
  'official-api',
  'phone-confirmed',
];
type VerificationMethodName = z.infer<typeof verificationMethod>;
export type VerificationMethod = z.infer<typeof verificationMethod>;

export const sourceRef = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  method: verificationMethod,
  checkedOn: isoDate,
  edition: z.string().optional(),
  note: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRef>;

export const sources = z.array(sourceRef).min(1, 'Every fact needs at least one source');

/** Text in every launch language. English is required; others fall back to English with a marker. */
export const localized = z.object({
  en: z.string().min(1),
  es: z.string().min(1).optional(),
  'zh-Hans': z.string().min(1).optional(),
  hi: z.string().min(1).optional(),
});
export type Localized = z.infer<typeof localized>;

const sourced = { sources, verifiedAsOf: isoDate };

// ---------------------------------------------------------------- manifest
export const manifestSchema = z.object({
  packId: z.string(),
  /** 'draft' = contains facts not yet confirmed on official pages (shown with a warning). 'release' = all confirmed. */
  status: z.enum(['draft', 'release']),
  version: z.string(),
  minAppVersion: z.string(),
  generatedAt: isoDate,
  files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});
export type Manifest = z.infer<typeof manifestSchema>;

// ---------------------------------------------------------------- region
export const linkSchema = z.object({
  id: z.string(),
  label: localized,
  url: z.string().url(),
  ...sourced,
});
export type PackLink = z.infer<typeof linkSchema>;

export const regionSchema = z.object({
  id: z.string(),
  name: localized,
  description: localized,
  counties: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  /** Informational only — congressional maps change; counties define the region. */
  districtsNote: localized.optional(),
  languages: z.array(z.string()).min(1),
  center: z.object({ lat: z.number(), lng: z.number() }),
  partnerDomains: z.array(z.string()).min(1),
  reportProblemEmail: z.string().email().optional(),
  /** Where people report a wrong fact or ask for a medicine to be added (e.g. an issue tracker). */
  reportProblemUrl: z.string().url().optional(),
  requestMedicineUrl: z.string().url().optional(),
  ...sourced,
});
export type Region = z.infer<typeof regionSchema>;

// ---------------------------------------------------------------- fpl
export const fplYearSchema = z.object({
  year: z.number().int(),
  /** Contiguous 48 states + DC, household sizes 1..8 */
  bySize: z.array(z.number().positive()).length(8),
  perAdditional: z.number().positive(),
  effectiveDate: isoDate,
  ...sourced,
});
export const fplSchema = z.object({ years: z.array(fplYearSchema).min(1) });
export type FplYear = z.infer<typeof fplYearSchema>;
export type FplTable = z.infer<typeof fplSchema>;

// ---------------------------------------------------------------- benefits (eligibility rules)
export const insuranceStatus = z.enum(['none', 'unsure', 'private', 'medi-cal', 'medicare', 'other']);
export type InsuranceStatus = z.infer<typeof insuranceStatus>;

export const ruleCondition = z.union([
  z.object({ insurance: z.array(insuranceStatus).min(1) }),
  z.object({ incomePctFplMax: z.number().positive() }),
  z.object({ incomePctFplMin: z.number().nonnegative() }),
  z.object({ age65: z.enum(['yes', 'no']) }),
  z.object({ county: z.array(z.string()).min(1) }),
]);
export type RuleCondition = z.infer<typeof ruleCondition>;

export const benefitRuleSchema = z.object({
  id: z.string(),
  programKey: z.enum(['medi-cal', 'covered-california', 'medicare', 'county', 'standard']),
  title: localized,
  summary: localized,
  when: z.object({ all: z.array(ruleCondition) }),
  fplYear: z.number().int().nullable(),
  /** Tier when all conditions pass. */
  tier: z.enum(['mayQualify', 'worthChecking']),
  links: z.array(linkSchema),
  nextSteps: z.array(localized),
  ...sourced,
});
export type BenefitRule = z.infer<typeof benefitRuleSchema>;
export const benefitsSchema = z.object({ rules: z.array(benefitRuleSchema) });

// ---------------------------------------------------------------- medications
export const pricingUnit = z.enum(['EA', 'ML', 'GM']);
export type PricingUnit = z.infer<typeof pricingUnit>;

export const strengthSchema = z.object({
  id: z.string(),
  label: localized,
  form: z.enum(['tablet', 'tablet-er', 'capsule', 'pen', 'vial', 'inhaler', 'other']),
  pricingUnit,
  /** How many pricing units are in one dispensed "count" (e.g. 1 tablet = 1 EA; 1 box of 5 x 3 mL pens = 15 ML). */
  unitsPerCount: z.number().positive(),
  countLabel: localized,
  quantities: z.array(z.number().int().positive()).min(1),
  defaultQuantity: z.number().int().positive(),
  /** Days one count lasts at a typical dose — null when it depends on the prescription. */
  daysPerCount: z.number().positive().nullable(),
  costPlusUrl: z.string().url().nullable(),
  nadacKey: z.string().nullable(),
});
export type Strength = z.infer<typeof strengthSchema>;

export const medicationSchema = z.object({
  id: z.string(),
  brand: z.string().nullable(),
  generic: z.string(),
  displayName: localized,
  aliases: z.record(z.string(), z.array(z.string())),
  category: z.enum(['diabetes', 'heart', 'blood-pressure', 'cholesterol', 'blood-thinner', 'other']),
  marketStatus: z.enum(['brandOnly', 'genericAvailable', 'biosimilarAvailable']),
  kind: z.enum(['small-molecule', 'biologic']),
  strengths: z.array(strengthSchema).min(1),
  goodRxUrl: z.string().url().nullable(),
  singleCareUrl: z.string().url().nullable(),
  programIds: z.array(z.string()),
  hasManufacturerPap: z.boolean(),
  common: z.boolean(),
  notes: z.array(localized),
  ...sourced,
});
export type Medication = z.infer<typeof medicationSchema>;
export const medicationsSchema = z.object({ medications: z.array(medicationSchema) });

// ---------------------------------------------------------------- prices
export const costPlusQuoteSchema = z.object({
  medicationId: z.string(),
  strengthId: z.string(),
  quantity: z.number().int().positive(),
  /** Price of the medicine incl. markup and pharmacy fee, in cents, before shipping. */
  priceCents: z.number().int().nonnegative(),
  productName: z.string(),
  url: z.string().url(),
});
export type CostPlusQuote = z.infer<typeof costPlusQuoteSchema>;

export const costPlusSnapshotSchema = z.object({
  /** null until a snapshot has been taken (prices then show "not loaded yet"). */
  snapshotDate: isoDate.nullable(),
  formula: z.object({
    markupPercent: z.number().nonnegative(),
    pharmacyFeeCents: z.number().int().nonnegative(),
    shippingCents: z.number().int().nonnegative().nullable(),
    ...sourced,
  }),
  quotes: z.array(costPlusQuoteSchema),
  notListed: z.array(z.object({ medicationId: z.string(), strengthId: z.string().nullable(), note: localized.optional() })),
  ...sourced,
});
export type CostPlusSnapshot = z.infer<typeof costPlusSnapshotSchema>;

export const nadacEntrySchema = z.object({
  key: z.string(),
  ndcDescription: z.string(),
  ndc: z.string(),
  perUnit: z.number().nonnegative(),
  pricingUnit,
  effectiveDate: isoDate,
  /** G, B, B-ANDA, B-BIO ... as published. */
  classification: z.string().optional(),
  /** How the value was chosen when several NDCs share a description (e.g. "median of 3 NDCs"). */
  note: z.string().optional(),
});
export type NadacEntry = z.infer<typeof nadacEntrySchema>;

export const nadacFeedSchema = z.object({
  /** null until the weekly refresh has run (the reference card then says "not loaded yet"). */
  asOfDate: isoDate.nullable(),
  datasetId: z.string().nullable(),
  entries: z.array(nadacEntrySchema),
  ...sourced,
});
export type NadacFeed = z.infer<typeof nadacFeedSchema>;

/** Prices offered directly by a manufacturer or a public program (e.g. state-label insulin). */
export const directPriceSchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  strengthIds: z.array(z.string()),
  seller: z.string(),
  description: localized,
  /** 'maximum' = a suggested/maximum price; the pharmacy sets the final price. */
  priceKind: z.enum(['fixed', 'maximum']),
  priceCents: z.number().int().nonnegative(),
  /** How many counts (tablets, boxes) the price is for — null when it's "per 30-day supply". */
  quantity: z.number().int().positive().nullable(),
  per: localized,
  url: z.string().url(),
  eligibility: localized,
  ...sourced,
});
export type DirectPrice = z.infer<typeof directPriceSchema>;
export const directPricesSchema = z.object({ prices: z.array(directPriceSchema) });

// ---------------------------------------------------------------- programs
export const programSchema = z.object({
  id: z.string(),
  kind: z.enum(['manufacturerPap', 'nonprofit', 'state', 'county', 'copayProgram']),
  name: z.string(),
  sponsor: z.string(),
  description: localized,
  medicationIds: z.array(z.string()),
  /** % of FPL. null = the program does not publish an income cap. */
  fplMax: z.number().positive().nullable(),
  fplYear: z.number().int().nullable(),
  insuranceRule: z.enum(['uninsuredOnly', 'uninsuredOrUnderinsured', 'medicareOk', 'commercialOnly', 'any', 'unknown']),
  insuranceRuleText: localized,
  closedToNew: z.boolean(),
  applicationUrl: z.string().url().nullable(),
  phone: z.string().nullable(),
  interpreterAvailable: z.boolean().nullable(),
  documents: z.array(localized),
  sendWhere: localized.nullable(),
  termMonths: z.number().int().positive().nullable(),
  cutoffNote: localized.nullable(),
  ...sourced,
});
export type Program = z.infer<typeof programSchema>;
export const programsSchema = z.object({ programs: z.array(programSchema) });

// ---------------------------------------------------------------- outlook
export const outlookSchema = z.object({
  medicationId: z.string(),
  kind: z.enum(['prediction', 'alreadyHasAlternative']),
  earliestDate: isoDate.nullable(),
  label: z.string().nullable(),
  basis: localized,
  ...sourced,
});
export type Outlook = z.infer<typeof outlookSchema>;
export const outlooksSchema = z.object({ outlooks: z.array(outlookSchema) });

// ---------------------------------------------------------------- places
const weekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export const hoursSchema = z.union([
  z.object({ seeLocator: z.literal(true) }),
  z.object({ weekly: z.array(z.object({ day: weekday, open: z.string(), close: z.string() })) }),
]);

export const pharmacySchema = z.object({
  id: z.string(),
  name: z.string(),
  chain: z.string(),
  address: z.string(),
  city: z.string(),
  zip: z.string(),
  county: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  phone: z.string().nullable(),
  hours: hoursSchema,
  locatorUrl: z.string().url(),
  addressVerified: z.boolean(),
  ...sourced,
});
export type Pharmacy = z.infer<typeof pharmacySchema>;
export const pharmaciesSchema = z.object({ pharmacies: z.array(pharmacySchema) });

export const clinicSchema = z.object({
  id: z.string(),
  name: z.string(),
  organization: z.string(),
  address: z.string(),
  city: z.string(),
  county: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  phone: z.string().nullable(),
  url: z.string().url(),
  zip: z.string().nullable(),
  slidingFee: z.boolean().nullable(),
  hasPharmacy: z.boolean().nullable(),
  /** Free-text pharmacy hours exactly as published, or null. */
  pharmacyHours: localized.nullable(),
  languages: z.array(z.string()),
  ...sourced,
});
export type Clinic = z.infer<typeof clinicSchema>;
export const clinicsSchema = z.object({ clinics: z.array(clinicSchema) });

export const helperSchema = z.object({
  id: z.string(),
  name: localized,
  what: localized,
  phone: z.string().nullable(),
  url: z.string().url().nullable(),
  forWhom: z.enum(['everyone', 'medicare', 'uninsured', 'covered-california', 'medi-cal']),
  /** Counties this helper serves (region county ids); empty = whole region. */
  counties: z.array(z.string()),
  ...sourced,
});
export type Helper = z.infer<typeof helperSchema>;
export const helpersSchema = z.object({ helpers: z.array(helperSchema) });

// ---------------------------------------------------------------- notices, facts, glossary
export const noticeSchema = z.object({
  id: z.string(),
  severity: z.enum(['info', 'caution']),
  appliesTo: z.array(z.enum(['medi-cal', 'covered-california', 'medicare', 'pharmacy', 'all'])),
  title: localized,
  body: localized,
  effectiveDate: isoDate.nullable(),
  ...sourced,
});
export type Notice = z.infer<typeof noticeSchema>;
export const noticesSchema = z.object({ notices: z.array(noticeSchema) });

/** Small verified facts shown in copy (e.g. a Medicare cap), referenced by id. */
export const factSchema = z.object({
  id: z.string(),
  title: localized,
  body: localized,
  ...sourced,
});
export type Fact = z.infer<typeof factSchema>;
export const factsSchema = z.object({ facts: z.array(factSchema) });

export const glossarySchema = z.object({
  terms: z.array(
    z.object({
      id: z.string(),
      term: localized,
      definition: localized,
      ...sourced,
    }),
  ),
});
export type GlossaryTerm = z.infer<typeof glossarySchema>['terms'][number];

/** Whole-pack type assembled by the loader. */
export type Pack = {
  manifest: Manifest;
  region: Region;
  fpl: FplTable;
  benefits: z.infer<typeof benefitsSchema>;
  medications: Medication[];
  programs: Program[];
  outlooks: Outlook[];
  pharmacies: Pharmacy[];
  clinics: Clinic[];
  helpers: Helper[];
  notices: Notice[];
  facts: Fact[];
  glossary: GlossaryTerm[];
  costPlus: CostPlusSnapshot;
  nadac: NadacFeed;
  directPrices: DirectPrice[];
};
