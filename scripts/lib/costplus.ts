/**
 * Pure helpers for scripts/snapshot-costplus.ts (no network).
 *
 * Cost Plus Drugs public API (docs: https://costplusdrugs.github.io/apidocs/, source:
 * github.com/costplusdrugs/apidocs, gh-pages branch):
 *   GET https://us-central1-costplusdrugs-publicapi.cloudfunctions.net/main
 *     → { results: [{ medication_name, brand_name, strength, form, pill_nonpill, ndc, slug,
 *                     unit_price: "$0.050", url }] }                      (full listing)
 *   …/main?ndc=<11 digits>&quantity_units=<n>
 *     → same rows plus requested_quote: "$4.50", requested_quote_units: n  (a quote)
 * Per the docs a quote is "subject to additional shipping charges"; in the docs' example
 * ($0.050 × 30 = $1.50 + pharmacy fee = $4.50) it includes the pharmacy fee — matching our
 * schema: priceCents = medicine incl. markup and pharmacy fee, before shipping.
 */
import { z } from 'zod';

const text = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

export const costPlusRowSchema = z.object({
  ndc: text,
  url: z.string(),
  medication_name: z.string().optional(),
  brand_name: z.string().nullish(),
  strength: z.string().optional(),
  form: z.string().optional(),
  pill_nonpill: z.string().optional(),
  slug: z.string().optional(),
  unit_price: z.string().nullish(),
  requested_quote: z.string().nullish(),
  requested_quote_units: text.nullish(),
  error_message: z.string().nullish(),
});
export type CostPlusRow = z.infer<typeof costPlusRowSchema>;

export const costPlusResponseSchema = z.object({ results: z.array(z.unknown()) });

/** Parses the rows of a response; malformed rows are counted and ignored. */
export function parseCostPlusRows(json: unknown): { rows: CostPlusRow[]; rejected: number } | null {
  const r = costPlusResponseSchema.safeParse(json);
  if (!r.success) return null;
  const rows: CostPlusRow[] = [];
  let rejected = 0;
  for (const item of r.data.results) {
    const p = costPlusRowSchema.safeParse(item);
    if (p.success) rows.push(p.data);
    else rejected++;
  }
  return { rows, rejected };
}

/** "$1,234.56" → 123456. Returns null for anything that isn't a plain dollar amount. */
export function dollarsToCents(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = value.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** "$0.050" → 0.05 (dollars per unit, full precision). */
export function dollars(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = value.trim().replace(/^\$/, '').replace(/,/g, '');
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** Product page identity: "https://www.costplusdrugs.com/medications/x-500mg-tablet/" → "/medications/x-500mg-tablet". */
export function productPath(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'costplusdrugs.com') return null;
    return u.pathname.toLowerCase().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Rows of the full listing whose product page is the same as `costPlusUrl`. */
export function matchListing(listing: readonly CostPlusRow[], costPlusUrl: string): CostPlusRow[] {
  const want = productPath(costPlusUrl);
  if (!want) return [];
  return listing.filter((r) => productPath(r.url) === want);
}

export function productName(row: CostPlusRow): string {
  return (
    [row.medication_name, row.strength, row.form]
      .filter((s) => s && s.trim())
      .join(' ')
      .trim() ||
    row.slug ||
    row.ndc
  );
}

export const isPill = (row: CostPlusRow) => (row.pill_nonpill ?? '').toLowerCase() === 'pill';
