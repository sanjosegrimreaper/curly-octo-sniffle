import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { LANGUAGES, type Lang } from './languages';
import { en, NAMESPACES, resources } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof en;
  }
}

let initialized = false;

export function initI18n(lang: Lang) {
  if (initialized) {
    if (i18next.language !== lang) void i18next.changeLanguage(lang);
    return i18next;
  }
  initialized = true;
  void i18next.use(initReactI18next).init({
    resources,
    lng: lang,
    fallbackLng: 'en',
    ns: [...NAMESPACES],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
  return i18next;
}

export function setLanguage(lang: Lang) {
  void i18next.changeLanguage(lang);
}

/** A fixed-language `t` (for bilingual handouts and the counter card). */
export function tFor(lang: Lang) {
  return i18next.getFixedT(lang);
}

export function intlTag(lang: Lang) {
  return LANGUAGES[lang].intlTag;
}

export { i18next };
