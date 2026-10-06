/**
 * Small pure helpers for the assistance-program screens (formatting only — no facts are made up here).
 */
import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import type { Medication, Program } from '@/data/schemas';
import { addMonths, formatISODate, parseISODate } from '@/domain';
import type { Lang } from '@/i18n/languages';

const TOLL_FREE = new Set(['800', '833', '844', '855', '866', '877', '888']);

/** Ten US digits (drops a leading country code 1), or null when the number isn't a plain US number. */
function usDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length === 10) return d;
  return null;
}

/**
 * "1-800-736-0003" for toll-free numbers, "(408) 555-0100" for local ones.
 * Anything that isn't a plain US number is shown exactly as published.
 */
export function formatPhone(raw: string): string {
  const d = usDigits(raw);
  if (!d) return raw.trim();
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6);
  return TOLL_FREE.has(a) ? `1-${a}-${b}-${c}` : `(${a}) ${b}-${c}`;
}

/** Digits separated by spaces so screen readers say each one ("1 8 0 0 ..."). */
export function phoneForSpeech(raw: string): string {
  return raw.replace(/\D/g, '').split('').join(' ');
}

/** "lillycares.com" from a URL (for button labels that name where they go). */
export function siteOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function isPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/** Display names of the medicines a program covers — only medicines that exist in this app. */
export function coveredNames(program: Program, lang: Lang): string[] {
  const meds = getPack().medications;
  return program.medicationIds
    .map((id) => meds.find((m) => m.id === id))
    .filter((m): m is Medication => !!m)
    .map((m) => loc(m.displayName, lang));
}

/** Short name for headings: the brand for brand-only medicines ("Eliquis"), else the generic name. */
export function shortMedicineName(med: Medication): string {
  return med.brand && med.marketStatus === 'brandOnly' ? med.brand : med.generic;
}

export function findProgram(id: string | undefined): Program | undefined {
  if (!id) return undefined;
  return getPack().programs.find((p) => p.id === id);
}

export function findMedication(id: string | undefined | null): Medication | undefined {
  if (!id) return undefined;
  return getPack().medications.find((m) => m.id === id);
}

/** Today + n calendar months as YYYY-MM-DD (clamped to month end). */
export function addMonthsISO(iso: string, months: number): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return formatISODate(addMonths(d, months));
}

/** Documents ready / total for a program's checklist. */
export function docsProgress(program: Program, docs: Record<string, boolean> | undefined) {
  const total = program.documents.length;
  const ready = program.documents.reduce((n, _d, i) => n + (docs?.[String(i)] ? 1 : 0), 0);
  return { ready, total };
}
