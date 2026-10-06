import type { NadacFeed, Pack, SourceRef } from '@/data/schemas';
import { isConfirmed } from '@/domain';

export type FileKey =
  | 'region'
  | 'fpl'
  | 'benefits'
  | 'medications'
  | 'programs'
  | 'outlook'
  | 'pharmacies'
  | 'clinics'
  | 'helpers'
  | 'notices'
  | 'facts'
  | 'glossary'
  | 'direct'
  | 'costPlus'
  | 'nadac';

export type FileStat = { key: FileKey; records: number; confirmed: number; unconfirmed: number };

/** Records per pack file, and how many are confirmed on the official source (domain `isConfirmed`). */
export function packStats(pack: Pack, nadac: NadacFeed = pack.nadac): FileStat[] {
  const groups: [FileKey, readonly { sources: SourceRef[] }[]][] = [
    ['region', [pack.region]],
    ['fpl', pack.fpl.years],
    ['benefits', pack.benefits.rules],
    ['medications', pack.medications],
    ['programs', pack.programs],
    ['outlook', pack.outlooks],
    ['pharmacies', pack.pharmacies],
    ['clinics', pack.clinics],
    ['helpers', pack.helpers],
    ['notices', pack.notices],
    ['facts', pack.facts],
    ['glossary', pack.glossary],
    ['direct', pack.directPrices],
    ['costPlus', [pack.costPlus]],
    ['nadac', [nadac]],
  ];
  return groups.map(([key, records]) => {
    const confirmed = records.filter((r) => isConfirmed(r.sources)).length;
    return { key, records: records.length, confirmed, unconfirmed: records.length - confirmed };
  });
}
