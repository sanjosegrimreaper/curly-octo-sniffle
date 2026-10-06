/**
 * Rounding helpers. Money is carried as exact (unrounded) numbers through every
 * computation and rounded exactly once, at the end, with these helpers.
 */

/**
 * Removes binary floating-point noise before rounding, e.g. `1.005 * 100`
 * (= 100.49999999999999) becomes 100.5. Twelve significant digits is far more
 * precision than any price or income in this app needs, and far less than a
 * double carries, so genuine values are never changed.
 */
export function cleanFloat(x: number): number {
  return Number.isFinite(x) ? Number(x.toPrecision(12)) : x;
}

/** Rounds a (possibly fractional) number of cents to whole cents, half away from zero. */
export function roundCents(cents: number): number {
  const c = cleanFloat(cents);
  const r = Math.sign(c) * Math.round(Math.abs(c));
  return r === 0 ? 0 : r;
}

/** Rounds a dollar amount to 2 decimals (whole cents). */
export function roundDollarsToCents(dollars: number): number {
  return roundCents(dollars * 100) / 100;
}
