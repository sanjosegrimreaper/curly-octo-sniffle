// Static imports so Metro bundles every locale (works offline, no network fetch).
import enCommon from './locales/en/common.json';
import enHelp from './locales/en/help.json';
import enMedicines from './locales/en/medicines.json';
import enOnboarding from './locales/en/onboarding.json';
import enPlan from './locales/en/plan.json';
import enPrograms from './locales/en/programs.json';
import enResults from './locales/en/results.json';
import enSearch from './locales/en/search.json';
import enSettings from './locales/en/settings.json';
import esCommon from './locales/es/common.json';
import esHelp from './locales/es/help.json';
import esMedicines from './locales/es/medicines.json';
import esOnboarding from './locales/es/onboarding.json';
import esPlan from './locales/es/plan.json';
import esPrograms from './locales/es/programs.json';
import esResults from './locales/es/results.json';
import esSearch from './locales/es/search.json';
import esSettings from './locales/es/settings.json';
import hiCommon from './locales/hi/common.json';
import hiHelp from './locales/hi/help.json';
import hiMedicines from './locales/hi/medicines.json';
import hiOnboarding from './locales/hi/onboarding.json';
import hiPlan from './locales/hi/plan.json';
import hiPrograms from './locales/hi/programs.json';
import hiResults from './locales/hi/results.json';
import hiSearch from './locales/hi/search.json';
import hiSettings from './locales/hi/settings.json';
import zhCommon from './locales/zh-Hans/common.json';
import zhHelp from './locales/zh-Hans/help.json';
import zhMedicines from './locales/zh-Hans/medicines.json';
import zhOnboarding from './locales/zh-Hans/onboarding.json';
import zhPlan from './locales/zh-Hans/plan.json';
import zhPrograms from './locales/zh-Hans/programs.json';
import zhResults from './locales/zh-Hans/results.json';
import zhSearch from './locales/zh-Hans/search.json';
import zhSettings from './locales/zh-Hans/settings.json';

export const NAMESPACES = [
  'common',
  'onboarding',
  'search',
  'results',
  'programs',
  'plan',
  'medicines',
  'help',
  'settings',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const en = {
  common: enCommon,
  onboarding: enOnboarding,
  search: enSearch,
  results: enResults,
  programs: enPrograms,
  plan: enPlan,
  medicines: enMedicines,
  help: enHelp,
  settings: enSettings,
};

export const resources = {
  en,
  es: {
    common: esCommon,
    onboarding: esOnboarding,
    search: esSearch,
    results: esResults,
    programs: esPrograms,
    plan: esPlan,
    medicines: esMedicines,
    help: esHelp,
    settings: esSettings,
  },
  'zh-Hans': {
    common: zhCommon,
    onboarding: zhOnboarding,
    search: zhSearch,
    results: zhResults,
    programs: zhPrograms,
    plan: zhPlan,
    medicines: zhMedicines,
    help: zhHelp,
    settings: zhSettings,
  },
  hi: {
    common: hiCommon,
    onboarding: hiOnboarding,
    search: hiSearch,
    results: hiResults,
    programs: hiPrograms,
    plan: hiPlan,
    medicines: hiMedicines,
    help: hiHelp,
    settings: hiSettings,
  },
} as const;
