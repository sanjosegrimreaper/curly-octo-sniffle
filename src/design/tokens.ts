/**
 * Daybreak design tokens.
 *
 * Every text/background pairing below is checked by `scripts/contrast-check.ts`
 * (WCAG 2.2: body text >= 4.5:1, large text / UI >= 3:1, high contrast >= 7:1).
 * Change a value here, run `npm run check:contrast`.
 */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

/** Minimum tap target (WCAG 2.5.8 asks for 24; we use 48 for older hands). */
export const minTap = 48;
export const primaryButtonHeight = 56;

export type SignalName = 'mint' | 'sky' | 'lilac' | 'tangerine' | 'sunflower' | 'coral' | 'slate';

/**
 * fill   — bright decorative color (illustrations, sparkles, large soft shapes)
 * solid  — meaningful non-text graphics (bars, rings, progress) >= 3:1 on surface
 * tint   — background wash behind text
 * ink    — text and icons; AA on surface and on tint
 */
export type Signal = { fill: string; solid: string; tint: string; ink: string };

export type Palette = {
  bg: string;
  grid: string;
  gridMajor: string;
  surface: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentInk: string;
  onAccent: string;
  focus: string;
  shadow: string;
  scrim: string;
  signals: Record<SignalName, Signal>;
};

const lightSignals: Record<SignalName, Signal> = {
  mint: { fill: '#20C997', solid: '#0CA678', tint: '#E6FCF5', ink: '#087F5B' },
  sky: { fill: '#339AF0', solid: '#1C7ED6', tint: '#E7F5FF', ink: '#1864AB' },
  lilac: { fill: '#9775FA', solid: '#7950F2', tint: '#F3F0FF', ink: '#6741D9' },
  tangerine: { fill: '#FF922B', solid: '#E8590C', tint: '#FFF4E6', ink: '#C2410C' },
  sunflower: { fill: '#FCC419', solid: '#D97706', tint: '#FFF9DB', ink: '#8A5A00' },
  coral: { fill: '#FF6B6B', solid: '#FA5252', tint: '#FFF5F5', ink: '#C92A2A' },
  slate: { fill: '#94A3B8', solid: '#64748B', tint: '#F1F5F9', ink: '#334155' },
};

const darkSignals: Record<SignalName, Signal> = {
  mint: { fill: '#38D9A9', solid: '#38D9A9', tint: '#0B2A22', ink: '#63E6BE' },
  sky: { fill: '#4DABF7', solid: '#4DABF7', tint: '#0C2236', ink: '#74C0FC' },
  lilac: { fill: '#9775FA', solid: '#9775FA', tint: '#1E1838', ink: '#B197FC' },
  tangerine: { fill: '#FF922B', solid: '#FF922B', tint: '#2E1A0B', ink: '#FFA94D' },
  sunflower: { fill: '#FCC419', solid: '#FCC419', tint: '#2B2408', ink: '#FFD43B' },
  coral: { fill: '#FF6B6B', solid: '#FF6B6B', tint: '#2E1215', ink: '#FF8787' },
  slate: { fill: '#94A3B8', solid: '#94A3B8', tint: '#1B2333', ink: '#CBD5E1' },
};

export const lightPalette: Palette = {
  bg: '#EEF6FF',
  grid: 'rgba(59,130,246,0.07)',
  gridMajor: 'rgba(59,130,246,0.12)',
  surface: '#FFFFFF',
  surfaceSunken: '#F5F9FE',
  border: '#D5E1EF',
  /** Boundaries of inputs, unselected chips and steppers (WCAG 1.4.11: >= 3:1). */
  borderStrong: '#64748B',
  text: '#0F172A',
  textMuted: '#475569',
  accent: '#4F46E5',
  accentSoft: '#E0E7FF',
  accentInk: '#3730A3',
  onAccent: '#FFFFFF',
  focus: '#1D4ED8',
  shadow: 'rgba(79,70,229,0.10)',
  scrim: 'rgba(15,23,42,0.45)',
  signals: lightSignals,
};

export const darkPalette: Palette = {
  bg: '#0B1020',
  grid: 'rgba(148,163,184,0.05)',
  gridMajor: 'rgba(148,163,184,0.09)',
  surface: '#131A2E',
  surfaceSunken: '#0F1526',
  border: '#2A3654',
  borderStrong: '#8090AB',
  text: '#F1F5F9',
  textMuted: '#A7B3C7',
  accent: '#A5B4FC',
  accentSoft: '#232B52',
  accentInk: '#C7D2FE',
  onAccent: '#0B1020',
  focus: '#FCD34D',
  shadow: 'rgba(0,0,0,0.35)',
  scrim: 'rgba(0,0,0,0.6)',
  signals: darkSignals,
};

const hcLightSignal = (ink: string): Signal => ({ fill: ink, solid: ink, tint: '#FFFFFF', ink });
const hcDarkSignal = (ink: string): Signal => ({ fill: ink, solid: ink, tint: '#000000', ink });

export const highContrastLightPalette: Palette = {
  bg: '#FFFFFF',
  grid: 'transparent',
  gridMajor: 'transparent',
  surface: '#FFFFFF',
  surfaceSunken: '#FFFFFF',
  border: '#000000',
  borderStrong: '#000000',
  text: '#000000',
  textMuted: '#1E293B',
  accent: '#1E1B6E',
  accentSoft: '#FFFFFF',
  accentInk: '#1E1B6E',
  onAccent: '#FFFFFF',
  focus: '#B45309',
  shadow: 'transparent',
  scrim: 'rgba(0,0,0,0.7)',
  signals: {
    mint: hcLightSignal('#054D37'),
    sky: hcLightSignal('#0B3A66'),
    lilac: hcLightSignal('#3B1F8C'),
    tangerine: hcLightSignal('#7C2D12'),
    sunflower: hcLightSignal('#5C3B00'),
    coral: hcLightSignal('#7F1D1D'),
    slate: hcLightSignal('#1E293B'),
  },
};

export const highContrastDarkPalette: Palette = {
  bg: '#000000',
  grid: 'transparent',
  gridMajor: 'transparent',
  surface: '#000000',
  surfaceSunken: '#000000',
  border: '#FFFFFF',
  borderStrong: '#FFFFFF',
  text: '#FFFFFF',
  textMuted: '#E2E8F0',
  accent: '#C7D2FE',
  accentSoft: '#000000',
  accentInk: '#C7D2FE',
  onAccent: '#000000',
  focus: '#FDE047',
  shadow: 'transparent',
  scrim: 'rgba(0,0,0,0.8)',
  signals: {
    mint: hcDarkSignal('#96F2D7'),
    sky: hcDarkSignal('#A5D8FF'),
    lilac: hcDarkSignal('#D0BFFF'),
    tangerine: hcDarkSignal('#FFD8A8'),
    sunflower: hcDarkSignal('#FFEC99'),
    coral: hcDarkSignal('#FFC9C9'),
    slate: hcDarkSignal('#E2E8F0'),
  },
};

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  celebrate: 600,
  /** cubic-bezier(.2, 0, 0, 1) */
  easing: [0.2, 0, 0, 1] as const,
  spring: { damping: 18, stiffness: 180, mass: 1 },
  pressScale: 0.97,
} as const;

/** Base type scale in dp; multiplied by OS font scale (allowFontScaling) and the in-app text size. */
export const typeScale = {
  display: { size: 34, line: 1.2 },
  title: { size: 28, line: 1.25 },
  heading: { size: 22, line: 1.3 },
  subheading: { size: 18, line: 1.35 },
  body: { size: 17, line: 1.5 },
  label: { size: 15, line: 1.4 },
  caption: { size: 13, line: 1.4 },
  price: { size: 40, line: 1.1 },
  priceSmall: { size: 24, line: 1.2 },
} as const;

export type TypeVariant = keyof typeof typeScale;
