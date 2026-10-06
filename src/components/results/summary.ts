/**
 * The shareable one-page summary: a bilingual model built from the pack and the price
 * summary (no estimates), and a print-friendly black-and-white HTML page made from it.
 * Every pack string is escaped. Unconfirmed facts carry "Not yet confirmed — call to confirm".
 */
import { loc } from '@/data/localize';
import type { BuyNowOption, PriceSummary } from '@/data/prices';
import type { Pack, SourceRef } from '@/data/schemas';
import { displayLimit, isConfirmed, type IncomeRange } from '@/domain';
import { formatDate, formatDollars, formatMoney, formatNumber, formatUnitPrice } from '@/i18n/format';
import { LANGUAGES, type Lang } from '@/i18n/languages';
import { escapeHtml } from '@/services/print';

import { packageText } from './BuyNowCard';
import { selectionText, type ResultsT } from './labels';

export type SummaryLine = { text: string; sub?: string; unconfirmed?: boolean };
export type SummarySection = { id: string; heading: string; lines: SummaryLine[] };
export type SummaryColumn = {
  lang: Lang;
  title: string;
  sections: SummarySection[];
  unconfirmedLabel: string;
  sourcesHeading: string;
  generated: string;
  scan: string;
  checked: (date: string) => string;
};

export type SummaryProfile = { householdSize: number | null; income: IncomeRange | null };

const optionLine = (t: ResultsT, o: BuyNowOption, summary: PriceSummary, lang: Lang): SummaryLine => {
  const pkg = packageText(t, o, summary.strength, lang);
  const price = formatMoney(o.priceCents, lang);
  return {
    text: o.priceKind === 'maximum' ? t('share.buyLineMax', { seller: o.seller, price, package: pkg }) : t('share.buyLine', { seller: o.seller, price, package: pkg }),
    sub: o.eligibility || undefined,
    unconfirmed: !o.confirmed,
  };
};

function profileLines(t: ResultsT, profile: SummaryProfile, lang: Lang): SummaryLine[] {
  const lines: SummaryLine[] = [];
  if (profile.householdSize !== null) lines.push({ text: t('share.household', { count: profile.householdSize }) });
  const r = profile.income;
  if (!r) lines.push({ text: t('share.incomeUnknown') });
  else if (r.max !== null && r.min === r.max) lines.push({ text: t('share.incomeExact', { amount: formatDollars(r.min, lang) }) });
  else if (r.max === null) lines.push({ text: t('share.incomeOver', { min: formatDollars(displayLimit(r.min), lang) }) });
  else if (r.min <= 0) lines.push({ text: t('share.incomeUnder', { max: formatDollars(displayLimit(r.max), lang) }) });
  else lines.push({ text: t('share.incomeRange', { min: formatDollars(displayLimit(r.min), lang), max: formatDollars(displayLimit(r.max), lang) }) });
  return lines;
}

/** One language column of the summary. `t` must be a fixed-language `t` for the results namespace. */
export function summaryColumn(
  pack: Pack,
  summary: PriceSummary,
  t: ResultsT,
  lang: Lang,
  opts: { today: string; profile: SummaryProfile | null },
): SummaryColumn {
  const med = summary.medication;
  const medConfirmed = isConfirmed(med.sources);
  const options = [...summary.comparable, ...summary.monthly];
  const sections: SummarySection[] = [];

  sections.push({
    id: 'medicine',
    heading: t('share.medicine'),
    lines: [{ text: loc(med.displayName, lang) }, { text: selectionText(t, summary.strength, summary.quantity, lang) }],
  });

  const buy: SummaryLine[] = options.map((o) => optionLine(t, o, summary, lang));
  if (buy.length === 0) buy.push({ text: t('share.noBuyNow') });
  if (summary.costPlus.status === 'notLoaded') buy.push({ text: t('costPlus.notLoaded') });
  if (summary.costPlus.status === 'notListed') buy.push({ text: t('costPlus.notListed') });
  sections.push({ id: 'buyNow', heading: t('share.buyNow'), lines: buy });

  const notListed = (site: string) => t('coupons.notListedSite', { site });
  sections.push({
    id: 'coupons',
    heading: t('share.coupons'),
    lines: [
      summary.coupons.goodRxUrl
        ? { text: 'GoodRx', sub: summary.coupons.goodRxUrl, unconfirmed: !medConfirmed }
        : { text: notListed('GoodRx') },
      summary.coupons.singleCareUrl
        ? { text: 'SingleCare', sub: summary.coupons.singleCareUrl, unconfirmed: !medConfirmed }
        : { text: notListed('SingleCare') },
    ],
  });

  const nadac = summary.nadacFeedLoaded ? summary.nadac : null;
  sections.push({
    id: 'reference',
    heading: t('share.reference'),
    lines: nadac
      ? [
          {
            text: t('nadac.math', {
              perUnit: formatUnitPrice(nadac.total.perUnit, lang),
              unit: t(`nadac.unit.${nadac.entry.pricingUnit}`),
              units: formatNumber(nadac.total.units, lang),
              total: formatMoney(nadac.total.totalCents, lang),
            }),
            sub: [t('nadac.cantBuy'), nadac.asOfDate ? t('nadac.asOf', { date: formatDate(nadac.asOfDate, lang) }) : null]
              .filter(Boolean)
              .join(' · '),
            unconfirmed: !isConfirmed(pack.nadac.sources),
          },
        ]
      : [{ text: t('nadac.notLoaded') }],
  });

  const programs = pack.programs.filter((p) => p.medicationIds.includes(med.id));
  sections.push({
    id: 'programs',
    heading: t('share.programs'),
    lines:
      programs.length > 0
        ? programs.map((p) => ({
            text: p.sponsor && p.sponsor !== p.name ? `${p.name} (${p.sponsor})` : p.name,
            sub: p.phone ? t('share.phone', { phone: p.phone }) : t('share.noPhone'),
            unconfirmed: !isConfirmed(p.sources),
          }))
        : [{ text: t('share.noPrograms') }],
  });

  if (opts.profile) {
    const lines = profileLines(t, opts.profile, lang);
    sections.push({ id: 'profile', heading: t('share.profile'), lines: lines.length ? lines : [{ text: t('share.noProfile') }] });
  }

  return {
    lang,
    title: t('share.docTitle'),
    sections,
    unconfirmedLabel: t('share.unconfirmed'),
    sourcesHeading: t('share.sources'),
    generated: t('share.generated', { date: formatDate(opts.today, lang, 'long') }),
    scan: t('share.scan'),
    checked: (date: string) => t('share.checked', { date: formatDate(date, lang) }),
  };
}

/** Every source behind the summary, once each (by URL). */
export function summarySources(pack: Pack, summary: PriceSummary): SourceRef[] {
  const med = summary.medication;
  const all: SourceRef[] = [
    ...med.sources,
    ...[...summary.comparable, ...summary.monthly].flatMap((o) => o.sources),
    ...pack.costPlus.sources,
    ...pack.nadac.sources,
    ...pack.programs.filter((p) => p.medicationIds.includes(med.id)).flatMap((p) => p.sources),
  ];
  const seen = new Set<string>();
  return all.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}

const e = escapeHtml;

function columnHtml(c: SummaryColumn): string {
  const sections = c.sections
    .map(
      (s) => `<h2>${e(s.heading)}</h2><ul>${s.lines
        .map(
          (l) =>
            `<li><span class="main">${e(l.text)}</span>${l.sub ? `<br><span class="sub">${e(l.sub)}</span>` : ''}${
              l.unconfirmed ? `<br><span class="flag">${e(c.unconfirmedLabel)}</span>` : ''
            }</li>`,
        )
        .join('')}</ul>`,
    )
    .join('');
  return `<section class="col" lang="${e(LANGUAGES[c.lang].intlTag)}"><h1>${e(c.title)}</h1>${sections}</section>`;
}

/** Print-friendly, black-and-white HTML for expo-print. `qr` is an SVG string from qrSvg(). */
export function summaryHtml(columns: SummaryColumn[], sources: SourceRef[], qr: string, fileTitle: string): string {
  const first = columns[0];
  const sourcesHtml = sources
    .map(
      (s) =>
        `<li>${e(s.name)} — <span class="url">${e(s.url)}</span> (${columns
          .map((c) => `<span lang="${e(LANGUAGES[c.lang].intlTag)}">${e(c.checked(s.checkedOn))}</span>`)
          .join(' / ')})${
          s.method === 'unconfirmed'
            ? ` <span class="flag">${columns.map((c) => `<span lang="${e(LANGUAGES[c.lang].intlTag)}">${e(c.unconfirmedLabel)}</span>`).join(' / ')}</span>`
            : ''
        }</li>`,
    )
    .join('');
  const bilingual = (pick: (c: SummaryColumn) => string) =>
    columns.map((c) => `<span lang="${e(LANGUAGES[c.lang].intlTag)}">${e(pick(c))}</span>`).join(' / ');
  // The QR SVG comes from the qrcode library (our own deep link), not from user or pack text.
  const qrBlock = qr.trim().startsWith('<svg') ? qr : '';

  return `<!doctype html><html lang="${e(LANGUAGES[first?.lang ?? 'en'].intlTag)}"><head><meta charset="utf-8"><title>${e(fileTitle)}</title>
<style>
@page { margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #000; background: #fff; font: 10.5pt/1.45 -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans SC", "Noto Sans Devanagari", Arial, sans-serif; }
.brand { font-weight: 700; font-size: 10pt; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 6pt; }
.cols { display: flex; gap: 14pt; align-items: flex-start; }
.col { flex: 1 1 0; min-width: 0; }
h1 { font-size: 15pt; margin: 0 0 4pt; }
h2 { font-size: 11pt; margin: 10pt 0 3pt; padding-bottom: 2pt; border-bottom: 1.5pt solid #000; }
ul { margin: 0; padding-left: 12pt; }
li { margin: 2pt 0; break-inside: avoid; }
.sub { color: #000; font-size: 9.5pt; word-break: break-all; }
.flag { font-weight: 700; font-size: 9pt; border: 1pt solid #000; padding: 0 3pt; }
.foot { margin-top: 14pt; border-top: 1.5pt solid #000; padding-top: 6pt; display: flex; gap: 14pt; align-items: flex-start; }
.sources { flex: 1; font-size: 8.5pt; }
.sources h2 { font-size: 10pt; margin-top: 0; }
.url { word-break: break-all; }
.qr { width: 96pt; text-align: center; font-size: 8pt; }
.qr svg { width: 96pt; height: 96pt; }
.gen { font-size: 8.5pt; margin-top: 6pt; }
</style></head><body>
<div class="brand">RxBridge</div>
<div class="cols">${columns.map(columnHtml).join('')}</div>
<div class="foot">
<div class="sources"><h2>${bilingual((c) => c.sourcesHeading)}</h2><ul>${sourcesHtml}</ul>
<div class="gen">${bilingual((c) => c.generated)}</div></div>
${qrBlock ? `<div class="qr">${qrBlock}<div>${bilingual((c) => c.scan)}</div></div>` : ''}
</div>
</body></html>`;
}
