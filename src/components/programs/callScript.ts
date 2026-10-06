/**
 * Builds the Call coach script from the person's own answers. Every sentence is a translated
 * template; only the person's facts (medicine, strength, household, coverage, income range)
 * are filled in. Unknown answers are left out — never guessed.
 */
import type { TFunction } from 'i18next';

import { loc } from '@/data/localize';
import type { InsuranceStatus, Medication } from '@/data/schemas';
import { displayLimit, type IncomeRange } from '@/domain';
import { formatDollars } from '@/i18n/format';
import type { Lang } from '@/i18n/languages';

export type ScriptInput = {
  medication: Medication | undefined;
  strengthId: string | null;
  /** null when the coverage question wasn't answered (the line is left out). */
  insurance: InsuranceStatus | null;
  householdSize: number | null;
  income: IncomeRange | null;
  /** True when the income was typed exactly (not a bracket). */
  incomeExact: boolean;
};

/** "Eliquis (apixaban)" for brand-only medicines, otherwise the generic name ("insulin glargine"). */
export function scriptMedicineName(med: Medication): string {
  return med.brand && med.marketStatus === 'brandOnly' ? `${med.brand} (${med.generic})` : med.generic;
}

export function buildCallScript(t: TFunction<'programs'>, lang: Lang, input: ScriptInput): string[] {
  const lines: string[] = [];
  const { medication, strengthId } = input;

  if (medication) {
    const strength = strengthId ? medication.strengths.find((s) => s.id === strengthId) : undefined;
    const medicine = scriptMedicineName(medication);
    lines.push(
      strength
        ? t('coach.script.helloStrength', { medicine, strength: loc(strength.label, lang) })
        : t('coach.script.hello', { medicine }),
    );
  } else {
    lines.push(t('coach.script.helloGeneric'));
  }

  if (input.insurance) lines.push(t(`coach.script.coverage.${input.insurance}`));

  const size = input.householdSize;
  if (size !== null) lines.push(t('coach.script.household', { count: size }));

  // "My income" for one person, "Our household income" otherwise (also when the size is unknown).
  const count = size ?? 2;
  const r = input.income;
  if (r) {
    const money = (n: number) => formatDollars(displayLimit(n), lang);
    if (input.incomeExact) {
      lines.push(t('coach.script.incomeExact', { count, amount: money(r.min) }));
    } else if (r.max === null) {
      lines.push(t('coach.script.incomeOver', { count, min: money(r.min) }));
    } else if (r.min <= 0) {
      lines.push(t('coach.script.incomeUnder', { count, max: money(r.max) }));
    } else {
      lines.push(t('coach.script.incomeBetween', { count, min: money(r.min), max: money(r.max) }));
    }
  }

  lines.push(t('coach.script.ask'));
  lines.push(t('coach.script.askSend'));
  return lines;
}
