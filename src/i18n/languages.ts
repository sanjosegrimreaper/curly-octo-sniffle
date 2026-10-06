export const LAUNCH_LANGUAGES = ['en', 'es', 'zh-Hans', 'hi'] as const;
export type Lang = (typeof LAUNCH_LANGUAGES)[number];

export type LanguageInfo = {
  code: Lang;
  /** Name in its own script — shown on the language picker. Never a flag. */
  nativeName: string;
  /** English name, for screen readers and the share sheet. */
  englishName: string;
  /** BCP 47 tag used for Intl formatting and text-to-speech. */
  intlTag: string;
  script: 'latin' | 'han' | 'devanagari';
  rtl: boolean;
};

export const LANGUAGES: Record<Lang, LanguageInfo> = {
  en: { code: 'en', nativeName: 'English', englishName: 'English', intlTag: 'en-US', script: 'latin', rtl: false },
  es: { code: 'es', nativeName: 'Español', englishName: 'Spanish', intlTag: 'es-US', script: 'latin', rtl: false },
  'zh-Hans': {
    code: 'zh-Hans',
    nativeName: '中文（简体）',
    englishName: 'Chinese (Simplified)',
    intlTag: 'zh-Hans-US',
    script: 'han',
    rtl: false,
  },
  hi: { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', intlTag: 'hi-IN', script: 'devanagari', rtl: false },
};

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LAUNCH_LANGUAGES as readonly string[]).includes(value);
}

/** Best match for a device locale like "es-MX" or "zh-Hant-TW". Falls back to English. */
export function matchDeviceLanguage(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('hi')) return 'hi';
    if (lower.startsWith('zh')) {
      // Traditional-script users still get Simplified (the only Chinese we ship) — better than English.
      return 'zh-Hans';
    }
    if (lower.startsWith('en')) return 'en';
  }
  return 'en';
}
