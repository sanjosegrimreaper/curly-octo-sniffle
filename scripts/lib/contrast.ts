/**
 * WCAG 2.x contrast math. Only opaque hex colors are compared; anything with
 * transparency (rgba(), #RRGGBBAA, 'transparent') returns null and is skipped.
 */

export type RGB = { r: number; g: number; b: number };

/** Parses #RGB, #RRGGBB (and opaque #RGBA/#RRGGBBAA). Returns null for non-opaque or non-hex colors. */
export function parseHex(color: string): RGB | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!m || !m[1]) return null;
  let hex = m[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
  if (hex.length === 8) {
    if (hex.slice(6, 8).toLowerCase() !== 'ff') return null; // translucent: depends on what's behind it
    hex = hex.slice(0, 6);
  }
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colors (1–21), or null when either isn't an opaque hex color. */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return null;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
