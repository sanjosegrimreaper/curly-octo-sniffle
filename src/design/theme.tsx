import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';

import { LANGUAGES, type Lang } from '@/i18n/languages';
import { textSizeMultiplier, useSettings } from '@/state/settings';

import {
  darkPalette,
  highContrastDarkPalette,
  highContrastLightPalette,
  lightPalette,
  type Palette,
} from './tokens';

export type FontSet = {
  /** Rounded display face for headings (Latin only). */
  heading: string | undefined;
  headingWeight: '600' | '700' | undefined;
  body: string | undefined;
  bodyBold: string | undefined;
  boldWeight: '700' | undefined;
  /** Prices always use the body face with tabular figures (digits are Latin in every launch language). */
  price: string;
  lineHeightBoost: number;
};

export type Theme = {
  palette: Palette;
  scheme: 'light' | 'dark';
  highContrast: boolean;
  reduceMotion: boolean;
  haptics: boolean;
  /** In-app text size multiplier (stacks with the OS font scale). */
  textScale: number;
  lang: Lang;
  fonts: FontSet;
  showGrid: boolean;
};

export const FONT_FAMILIES = {
  heading: 'Fredoka_600SemiBold',
  body: 'AtkinsonHyperlegibleNext_400Regular',
  bodyBold: 'AtkinsonHyperlegibleNext_700Bold',
} as const;

export function fontsFor(lang: Lang): FontSet {
  const script = LANGUAGES[lang].script;
  if (script === 'latin') {
    return {
      heading: FONT_FAMILIES.heading,
      headingWeight: undefined,
      body: FONT_FAMILIES.body,
      bodyBold: FONT_FAMILIES.bodyBold,
      boldWeight: undefined,
      price: FONT_FAMILIES.bodyBold,
      lineHeightBoost: 1,
    };
  }
  // Fredoka and Atkinson have no Han or Devanagari glyphs: use the system face, which
  // renders both scripts correctly on iOS, Android and the web.
  return {
    heading: undefined,
    headingWeight: '700',
    body: undefined,
    bodyBold: undefined,
    boldWeight: '700',
    price: FONT_FAMILIES.bodyBold,
    // Devanagari matras need extra room; Han glyphs are taller than Latin x-height.
    lineHeightBoost: script === 'devanagari' ? 1.12 : 1.05,
  };
}

function useOsReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduce(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children, langOverride }: { children: ReactNode; langOverride?: Lang }) {
  const system = useColorScheme();
  const osReduce = useOsReduceMotion();
  const { themeMode, highContrast, reduceMotion, haptics, textSize, language } = useSettings();
  const lang: Lang = langOverride ?? language ?? 'en';

  const value = useMemo<Theme>(() => {
    const scheme: 'light' | 'dark' = themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;
    const palette = highContrast
      ? scheme === 'dark'
        ? highContrastDarkPalette
        : highContrastLightPalette
      : scheme === 'dark'
        ? darkPalette
        : lightPalette;
    return {
      palette,
      scheme,
      highContrast,
      reduceMotion: reduceMotion === 'system' ? osReduce : reduceMotion === 'on',
      haptics: haptics && Platform.OS !== 'web',
      textScale: textSizeMultiplier[textSize],
      lang,
      fonts: fontsFor(lang),
      showGrid: !highContrast,
    };
  }, [system, osReduce, themeMode, highContrast, reduceMotion, haptics, textSize, lang]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside <ThemeProvider>');
  return t;
}
