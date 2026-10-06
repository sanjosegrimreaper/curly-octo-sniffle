import type { Href } from 'expo-router';
import type { TFunction } from 'i18next';
import {
  CalendarClock,
  ClipboardList,
  FolderOpen,
  Landmark,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react-native';

import { loc } from '@/data/localize';
import type { PriceSummary } from '@/data/prices';
import type { Pack, SourceRef } from '@/data/schemas';
import { daysBetween, type PlanStep } from '@/domain';
import type { SignalName } from '@/design';
import { formatDate, formatMoney } from '@/i18n/format';
import type { Lang } from '@/i18n/languages';

import { medicineName, packageLabel, resultsHref, shortName } from './format';

export type StepSource = { sources: SourceRef[]; verifiedAsOf: string; recordId: string; title: string };

/** Everything a plan step card needs to render. */
export type StepView = {
  key: string;
  kindLabel: string;
  title: string;
  body: string | null;
  /** Names where the card goes ("See my coverage results"). */
  cta: string;
  href: Href;
  signal: SignalName;
  icon: LucideIcon;
  /** Buy-now steps only: label → big value → package → note (card anatomy). */
  price: { value: string; packageText: string; note: string } | null;
  source: StepSource | null;
  testID: string;
};

export type StepContext = {
  t: TFunction<'plan'>;
  lang: Lang;
  pack: Pack;
  /** Price summaries keyed `drugId:strengthId:quantity`. */
  summaries: ReadonlyMap<string, PriceSummary>;
  today: string;
};

const keyOf = (drugId: string, strengthId: string, quantity: number) => `${drugId}:${strengthId}:${quantity}`;

/** Turns a domain PlanStep into display text and a destination. Null when its record is missing from the pack. */
export function describeStep(step: PlanStep, ctx: StepContext): StepView | null {
  const { t, lang, pack } = ctx;
  switch (step.kind) {
    case 'finishScreener':
      return {
        key: step.kind,
        kindLabel: t('steps.finishScreener.kind'),
        title: t('steps.finishScreener.title'),
        body: t('steps.finishScreener.body'),
        cta: t('steps.finishScreener.cta'),
        href: '/onboarding/coverage' as Href,
        signal: 'lilac',
        icon: ClipboardList,
        price: null,
        source: null,
        testID: 'plan-step-finishScreener',
      };
    case 'applyBenefit': {
      const rule = pack.benefits.rules.find((r) => r.id === step.ruleId);
      if (!rule) return null;
      const title = loc(rule.title, lang);
      return {
        key: `${step.kind}:${rule.id}`,
        kindLabel: t('steps.applyBenefit.kind'),
        title,
        body: loc(rule.summary, lang),
        cta: t('steps.applyBenefit.cta'),
        href: '/onboarding/result' as Href,
        signal: 'lilac',
        icon: ShieldCheck,
        price: null,
        source: { sources: rule.sources, verifiedAsOf: rule.verifiedAsOf, recordId: `rule:${rule.id}`, title },
        testID: 'plan-step-applyBenefit',
      };
    }
    case 'checkMedicare':
      return {
        key: step.kind,
        kindLabel: t('steps.checkMedicare.kind'),
        title: t('steps.checkMedicare.title'),
        body: t('steps.checkMedicare.body'),
        cta: t('steps.checkMedicare.cta'),
        href: '/medicare' as Href,
        signal: 'lilac',
        icon: Landmark,
        price: null,
        source: null,
        testID: 'plan-step-checkMedicare',
      };
    case 'findMedicine':
      return {
        key: step.kind,
        kindLabel: t('steps.findMedicine.kind'),
        title: t('steps.findMedicine.title'),
        body: t('steps.findMedicine.body'),
        cta: t('steps.findMedicine.cta'),
        href: '/find' as Href,
        signal: 'sky',
        icon: Search,
        price: null,
        source: null,
        testID: 'plan-step-findMedicine',
      };
    case 'buyNow': {
      const summary = ctx.summaries.get(keyOf(step.drugId, step.strengthId, step.quantity));
      const lowest = summary?.lowest;
      if (!summary || !lowest) return null;
      const money = formatMoney(step.priceCents, lang);
      const name = medicineName(summary.medication, lang);
      return {
        key: `${step.kind}:${keyOf(step.drugId, step.strengthId, step.quantity)}`,
        kindLabel: t('steps.buyNow.kind'),
        title: name,
        body: null,
        cta: t('steps.buyNow.cta', { name: shortName(summary.medication, lang) }),
        href: resultsHref(step),
        signal: 'mint',
        icon: ShoppingBag,
        price: {
          value: lowest.priceKind === 'maximum' ? t('steps.buyNow.upTo', { price: money }) : money,
          packageText: packageLabel(summary.strength, step.quantity, lang),
          note: t('steps.buyNow.at', { seller: step.seller }),
        },
        source: {
          sources: lowest.sources,
          verifiedAsOf: lowest.verifiedAsOf,
          recordId: `price:${lowest.id}`,
          title: name,
        },
        testID: `plan-step-buyNow-${step.drugId}`,
      };
    }
    case 'callProgram': {
      const program = pack.programs.find((p) => p.id === step.programId);
      const med = pack.medications.find((m) => m.id === step.drugId);
      if (!program || !med) return null;
      return {
        key: `${step.kind}:${program.id}`,
        kindLabel: t('steps.callProgram.kind'),
        title: t('steps.callProgram.title', { program: program.name }),
        body: t('steps.callProgram.body', { medicine: shortName(med, lang) }),
        cta: t('steps.callProgram.cta', { program: program.name }),
        href: `/call-coach/${encodeURIComponent(program.id)}?drug=${encodeURIComponent(med.id)}` as Href,
        signal: 'lilac',
        icon: Phone,
        price: null,
        source: {
          sources: program.sources,
          verifiedAsOf: program.verifiedAsOf,
          recordId: `program:${program.id}`,
          title: program.name,
        },
        testID: `plan-step-callProgram-${program.id}`,
      };
    }
    case 'renew': {
      const program = pack.programs.find((p) => p.id === step.programId);
      if (!program) return null;
      const days = daysBetween(ctx.today, step.renewBy);
      const body = !Number.isFinite(days)
        ? null
        : days < 0
          ? t('steps.renew.overdue')
          : days === 0
            ? t('steps.renew.dueToday')
            : t('steps.renew.daysLeft', { count: days });
      return {
        key: `${step.kind}:${program.id}`,
        kindLabel: t('steps.renew.kind'),
        title: t('steps.renew.title', { program: program.name, date: formatDate(step.renewBy, lang) }),
        body,
        cta: t('steps.renew.cta'),
        href: '/applications' as Href,
        signal: 'sunflower',
        icon: CalendarClock,
        price: null,
        source: null,
        testID: `plan-step-renew-${program.id}`,
      };
    }
    case 'trackApplication': {
      const program = pack.programs.find((p) => p.id === step.programId);
      if (!program) return null;
      return {
        key: `${step.kind}:${program.id}`,
        kindLabel: t('steps.trackApplication.kind'),
        title: t('steps.trackApplication.title', { program: program.name }),
        body: t('steps.trackApplication.body'),
        cta: t('steps.trackApplication.cta'),
        href: '/applications' as Href,
        signal: 'lilac',
        icon: FolderOpen,
        price: null,
        source: null,
        testID: `plan-step-trackApplication-${program.id}`,
      };
    }
  }
}

export { keyOf as summaryKey };
