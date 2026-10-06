/**
 * Everything the app knows about the price of one selection (medicine × strength × quantity),
 * split into the three honest classes: Buy now, Coupon (link only), Reference (NADAC).
 */
import { loc } from '@/data/localize';
import type { CostPlusQuote, DirectPrice, Medication, NadacEntry, NadacFeed, Pack, SourceRef, Strength } from '@/data/schemas';
import {
  costPlusQuote,
  costPlusQuantities,
  findNadac,
  isConfirmed,
  isNotListed,
  nadacTotal,
  outlookTier,
  per30DaysCentsFromDaily,
  type NadacTotal,
  type OutlookTier,
} from '@/domain';
import type { Lang } from '@/i18n/languages';
import type { Selection } from '@/state/medicines';

export type BuyNowOption = {
  id: string;
  source: 'costPlus' | 'direct';
  /** The exact product the price is for. */
  product: string;
  seller: string;
  priceCents: number;
  priceKind: 'fixed' | 'maximum';
  /** Counts the price is for. null = per 30-day supply / per month (not comparable to a quantity). */
  quantity: number | null;
  per: string;
  description: string;
  eligibility: string;
  url: string;
  sources: SourceRef[];
  verifiedAsOf: string;
  confirmed: boolean;
  /** Cost Plus snapshot date, when the price came from a snapshot. */
  snapshotDate: string | null;
};

export type CostPlusStatus =
  | { status: 'quote'; quote: CostPlusQuote; snapshotDate: string; otherQuantities: number[] }
  | { status: 'otherQuantities'; quantities: number[]; snapshotDate: string | null }
  | { status: 'notListed' }
  | { status: 'notLoaded'; url: string | null };

export type PriceSummary = {
  medication: Medication;
  strength: Strength;
  quantity: number;
  costPlus: CostPlusStatus;
  /** Buy-now options for exactly this quantity (comparable), lowest first. */
  comparable: BuyNowOption[];
  /** Buy-now options priced per month / 30-day supply (not comparable to a fixed quantity). */
  monthly: BuyNowOption[];
  lowest: BuyNowOption | null;
  nadac: { entry: NadacEntry; total: NadacTotal; asOfDate: string | null } | null;
  nadacFeedLoaded: boolean;
  coupons: { goodRxUrl: string | null; singleCareUrl: string | null };
  outlook: { tier: OutlookTier; months: number | null };
  /** Cost per 30 days of the lowest comparable option, when the person told us how many a day. */
  lowestPer30DaysCents: number | null;
};

export function findSelection(pack: Pack, sel: Pick<Selection, 'drugId' | 'strengthId'>) {
  const medication = pack.medications.find((m) => m.id === sel.drugId);
  const strength = medication?.strengths.find((s) => s.id === sel.strengthId);
  return medication && strength ? { medication, strength } : null;
}

function directOption(d: DirectPrice, lang: Lang): BuyNowOption {
  return {
    id: d.id,
    source: 'direct',
    product: d.product,
    seller: d.seller,
    priceCents: d.priceCents,
    priceKind: d.priceKind,
    quantity: d.quantity,
    per: loc(d.per, lang),
    description: loc(d.description, lang),
    eligibility: loc(d.eligibility, lang),
    url: d.url,
    sources: d.sources,
    verifiedAsOf: d.verifiedAsOf,
    confirmed: isConfirmed(d.sources),
    snapshotDate: null,
  };
}

export function priceSummary(pack: Pack, feed: NadacFeed, sel: Selection, lang: Lang, today: string): PriceSummary | null {
  const found = findSelection(pack, sel);
  if (!found) return null;
  const { medication, strength } = found;
  const snap = pack.costPlus;

  let costPlus: CostPlusStatus;
  const quote = costPlusQuote(snap, medication.id, strength.id, sel.quantity);
  const quantities = costPlusQuantities(snap, medication.id, strength.id);
  if (quote && snap.snapshotDate) {
    costPlus = { status: 'quote', quote, snapshotDate: snap.snapshotDate, otherQuantities: quantities };
  } else if (quantities.length > 0) {
    costPlus = { status: 'otherQuantities', quantities, snapshotDate: snap.snapshotDate };
  } else if (isNotListed(snap, medication.id, strength.id)) {
    costPlus = { status: 'notListed' };
  } else {
    costPlus = { status: 'notLoaded', url: strength.costPlusUrl };
  }

  const options: BuyNowOption[] = [];
  if (costPlus.status === 'quote') {
    options.push({
      id: `costplus:${medication.id}:${strength.id}:${sel.quantity}`,
      source: 'costPlus',
      product: costPlus.quote.productName,
      seller: 'Mark Cuban Cost Plus Drugs',
      priceCents: costPlus.quote.priceCents,
      priceKind: 'fixed',
      quantity: sel.quantity,
      per: '',
      description: costPlus.quote.productName,
      eligibility: '',
      url: costPlus.quote.url,
      sources: snap.sources,
      verifiedAsOf: snap.verifiedAsOf,
      confirmed: isConfirmed(snap.sources),
      snapshotDate: costPlus.snapshotDate,
    });
  }
  const directs = pack.directPrices
    .filter((d) => d.medicationId === medication.id && d.strengthIds.includes(strength.id))
    .map((d) => directOption(d, lang));
  const comparable = [...options, ...directs.filter((d) => d.quantity === sel.quantity)].sort(
    (a, b) => a.priceCents - b.priceCents,
  );
  const monthly = directs.filter((d) => d.quantity === null).sort((a, b) => a.priceCents - b.priceCents);

  const entry = findNadac(feed, strength.nadacKey);
  const total = nadacTotal(entry, strength, sel.quantity);
  const lowest = comparable[0] ?? null;

  return {
    medication,
    strength,
    quantity: sel.quantity,
    costPlus,
    comparable,
    monthly,
    lowest,
    nadac: entry && total ? { entry, total, asOfDate: feed.asOfDate } : null,
    nadacFeedLoaded: feed.asOfDate !== null && feed.entries.length > 0,
    coupons: { goodRxUrl: medication.goodRxUrl, singleCareUrl: medication.singleCareUrl },
    outlook: outlookTier(
      pack.outlooks.find((o) => o.medicationId === medication.id),
      today,
    ),
    lowestPer30DaysCents: lowest
      ? per30DaysCentsFromDaily(lowest.priceCents, sel.quantity, sel.perDay ?? null)
      : null,
  };
}
