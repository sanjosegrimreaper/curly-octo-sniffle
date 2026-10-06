/**
 * Deep-link and route params for a medicine selection, validated with Zod.
 * Unknown medicine → not found. A bad strength or amount falls back to the defaults
 * from the pack (never an error screen for a typo in a link).
 */
import type { Href } from 'expo-router';
import { z } from 'zod';

import type { Medication, Pack, Strength } from '@/data/schemas';
import type { Selection } from '@/state/medicines';

export const MAX_QTY = 999;
export const PER_DAY_OPTIONS = [1, 2, 3, 4] as const;

type RawParam = string | string[] | undefined;
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const idSchema = z.preprocess(first, z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i));
const strengthSchema = z.preprocess(first, z.string().trim().min(1).max(80)).optional().catch(undefined);
const qtySchema = z.preprocess(first, z.coerce.number().int().min(1).max(MAX_QTY)).optional().catch(undefined);
const perDaySchema = z.preprocess(first, z.coerce.number().int().min(1).max(PER_DAY_OPTIONS.length)).optional().catch(undefined);

export type RawSelectionParams = { id?: RawParam; strength?: RawParam; qty?: RawParam; perDay?: RawParam };

export type ResolvedSelection =
  | { status: 'ok'; medication: Medication; strength: Strength; selection: Selection }
  | { status: 'notFound' };

/** Parses route params against the pack. */
export function resolveSelection(pack: Pack, raw: RawSelectionParams, fallback?: Selection | null): ResolvedSelection {
  const id = idSchema.safeParse(raw.id);
  if (!id.success) return { status: 'notFound' };
  const medication = pack.medications.find((m) => m.id === id.data);
  if (!medication) return { status: 'notFound' };

  const strengthId = strengthSchema.parse(raw.strength);
  const fromFallback = fallback && fallback.drugId === medication.id ? fallback : null;
  const strength =
    medication.strengths.find((s) => s.id === strengthId) ??
    medication.strengths.find((s) => s.id === fromFallback?.strengthId) ??
    medication.strengths[0];
  if (!strength) return { status: 'notFound' };

  const sameStrength = fromFallback && fromFallback.strengthId === strength.id ? fromFallback : null;
  const quantity = qtySchema.parse(raw.qty) ?? sameStrength?.quantity ?? strength.defaultQuantity;
  const perDay = perDaySchema.parse(raw.perDay) ?? sameStrength?.perDay ?? null;

  return {
    status: 'ok',
    medication,
    strength,
    selection: { drugId: medication.id, strengthId: strength.id, quantity, perDay },
  };
}

function query(sel: Selection, withPerDay = true) {
  const p = new URLSearchParams({ strength: sel.strengthId, qty: String(sel.quantity) });
  if (withPerDay && sel.perDay) p.set('perDay', String(sel.perDay));
  return p.toString();
}

const drugPath = (sel: Selection) => `/drug/${encodeURIComponent(sel.drugId)}`;

export const pickerHref = (sel: Selection) => `${drugPath(sel)}?${query(sel)}` as Href;
export const resultsHref = (sel: Selection) => `${drugPath(sel)}/results?${query(sel)}` as Href;

/** Counter card and share are top-level routes, so the medicine goes in `drug`. How many a day stays out. */
const topLevel = (sel: Selection) =>
  new URLSearchParams({ drug: sel.drugId, strength: sel.strengthId, qty: String(sel.quantity) }).toString();
export const counterHref = (sel: Selection) => `/counter-card?${topLevel(sel)}` as Href;
export const shareHref = (sel: Selection) => `/share?${topLevel(sel)}` as Href;

/** Deep link printed as a QR code on the shared summary (no dose information). */
export const deepLink = (sel: Selection) => `rxbridge:/${drugPath(sel)}/results?${query(sel, false)}`;
