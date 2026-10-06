/**
 * Loads the bundled region pack and validates every file with Zod.
 *
 * Packs are bundled with the app (works offline). Only the NADAC price feed is refreshed
 * from the network (see src/data/feeds.ts). A new region is a new folder under data/packs/
 * plus an entry in PACKS below — no screen code changes.
 */
import type { ZodType } from 'zod';

import benefitsJson from '@data/packs/ca-south-bay/benefits.json';
import clinicsJson from '@data/packs/ca-south-bay/clinics.json';
import costPlusJson from '@data/packs/ca-south-bay/prices/costplus.json';
import directPricesJson from '@data/packs/ca-south-bay/prices/direct.json';
import nadacJson from '@data/packs/ca-south-bay/prices/nadac.json';
import factsJson from '@data/packs/ca-south-bay/facts.json';
import fplJson from '@data/packs/ca-south-bay/fpl.json';
import glossaryJson from '@data/packs/ca-south-bay/glossary.json';
import helpersJson from '@data/packs/ca-south-bay/helpers.json';
import manifestJson from '@data/packs/ca-south-bay/manifest.json';
import medicationsJson from '@data/packs/ca-south-bay/medications.json';
import noticesJson from '@data/packs/ca-south-bay/notices.json';
import outlookJson from '@data/packs/ca-south-bay/outlook.json';
import pharmaciesJson from '@data/packs/ca-south-bay/pharmacies.json';
import programsJson from '@data/packs/ca-south-bay/programs.json';
import regionJson from '@data/packs/ca-south-bay/region.json';

import {
  benefitsSchema,
  clinicsSchema,
  costPlusSnapshotSchema,
  directPricesSchema,
  factsSchema,
  fplSchema,
  glossarySchema,
  helpersSchema,
  manifestSchema,
  medicationsSchema,
  nadacFeedSchema,
  noticesSchema,
  outlooksSchema,
  pharmaciesSchema,
  programsSchema,
  regionSchema,
  type Pack,
} from './schemas';

export class PackError extends Error {
  constructor(
    public file: string,
    public issues: string,
  ) {
    super(`Data pack file "${file}" failed validation: ${issues}`);
  }
}

function parse<T>(file: string, schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new PackError(
      file,
      r.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    );
  }
  return r.data;
}

/** Raw files of each bundled pack. */
export const PACK_FILES = {
  'ca-south-bay': {
    'manifest.json': manifestJson,
    'region.json': regionJson,
    'fpl.json': fplJson,
    'benefits.json': benefitsJson,
    'medications.json': medicationsJson,
    'programs.json': programsJson,
    'outlook.json': outlookJson,
    'pharmacies.json': pharmaciesJson,
    'clinics.json': clinicsJson,
    'helpers.json': helpersJson,
    'notices.json': noticesJson,
    'facts.json': factsJson,
    'glossary.json': glossaryJson,
    'prices/costplus.json': costPlusJson,
    'prices/nadac.json': nadacJson,
    'prices/direct.json': directPricesJson,
  },
} as const;

export type PackId = keyof typeof PACK_FILES;
export const DEFAULT_PACK: PackId = 'ca-south-bay';

export function buildPack(files: Record<string, unknown>): Pack {
  const f = (name: string) => files[name];
  return {
    manifest: parse('manifest.json', manifestSchema, f('manifest.json')),
    region: parse('region.json', regionSchema, f('region.json')),
    fpl: parse('fpl.json', fplSchema, f('fpl.json')),
    benefits: parse('benefits.json', benefitsSchema, f('benefits.json')),
    medications: parse('medications.json', medicationsSchema, f('medications.json')).medications,
    programs: parse('programs.json', programsSchema, f('programs.json')).programs,
    outlooks: parse('outlook.json', outlooksSchema, f('outlook.json')).outlooks,
    pharmacies: parse('pharmacies.json', pharmaciesSchema, f('pharmacies.json')).pharmacies,
    clinics: parse('clinics.json', clinicsSchema, f('clinics.json')).clinics,
    helpers: parse('helpers.json', helpersSchema, f('helpers.json')).helpers,
    notices: parse('notices.json', noticesSchema, f('notices.json')).notices,
    facts: parse('facts.json', factsSchema, f('facts.json')).facts,
    glossary: parse('glossary.json', glossarySchema, f('glossary.json')).terms,
    costPlus: parse('prices/costplus.json', costPlusSnapshotSchema, f('prices/costplus.json')),
    nadac: parse('prices/nadac.json', nadacFeedSchema, f('prices/nadac.json')),
    directPrices: parse('prices/direct.json', directPricesSchema, f('prices/direct.json')).prices,
  };
}

let cached: Pack | null = null;

export function getPack(): Pack {
  if (!cached) cached = buildPack(PACK_FILES[DEFAULT_PACK]);
  return cached;
}

/** Test hook. */
export function __setPackForTests(pack: Pack | null) {
  cached = pack;
}
