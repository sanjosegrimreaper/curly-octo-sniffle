/**
 * Dated Cost Plus Drugs price snapshot from its public pricing API.
 *
 *   npx tsx scripts/snapshot-costplus.ts [--dry-run] [--pack <id>] [--packs-dir <dir>]
 *
 * For every medication strength with a costPlusUrl:
 *  1. find its product in the API's full listing (same product page as costPlusUrl);
 *  2. ask for a quote for each of strengths[].quantities (…/main?ndc=…&quantity_units=…);
 *  3. write prices/costplus.json quotes [{ medicationId, strengthId, quantity, priceCents,
 *     productName, url }] — priceCents is the medicine incl. markup and pharmacy fee, before
 *     shipping — with snapshotDate = today and the source method official-api.
 * The formula block and notListed are kept as they are. Pill products only: for pens, vials
 * and inhalers the API's "units" are ambiguous, so those strengths are skipped (logged).
 *
 * Network trouble (offline, timeouts, 5xx, a proxy refusing the host) → message, exit 0,
 * nothing written. A result that fails costPlusSnapshotSchema, or no quotes at all → exit 1,
 * nothing written. COSTPLUS_API_BASE overrides the API URL (tests use a local mock).
 */
import fs from 'node:fs';
import path from 'node:path';

import { costPlusSnapshotSchema, medicationsSchema, type CostPlusSnapshot } from '../src/data/schemas';

import { color, parseArgs, readJsonFile, rel, run, table, todayLocal } from './lib/cli';
import {
  dollars,
  dollarsToCents,
  isPill,
  matchListing,
  parseCostPlusRows,
  productName,
  type CostPlusRow,
} from './lib/costplus';
import { formatJson, writeFileAtomic } from './lib/format';
import { fetchJson, HttpError, NetworkError } from './lib/http';
import { formatZodIssues, listPackIds, parseWith, resolvePacksDir } from './lib/packs';

const API = (
  process.env.COSTPLUS_API_BASE ?? 'https://us-central1-costplusdrugs-publicapi.cloudfunctions.net/main'
).replace(/\/+$/, '');
const FILE = 'prices/costplus.json';
const PAUSE_MS = 250;

type Quote = CostPlusSnapshot['quotes'][number];
type Line = { label: string; qty: string; price: string; fee: string; status: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getRows(url: string): Promise<CostPlusRow[]> {
  const parsed = parseCostPlusRows(await fetchJson(url, { timeoutMs: 60_000 }));
  if (!parsed) throw new HttpError(`unexpected response from the Cost Plus API (no "results" array): ${url}`, 200);
  if (parsed.rejected) console.log(color.yellow(`warn  ${parsed.rejected} malformed row(s) ignored from ${url}`));
  return parsed.rows;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2), ['pack', 'packs-dir']);
  const packsDir = resolvePacksDir(args.value('packs-dir'));
  const only = args.value('pack');
  const today = todayLocal();

  const packs = listPackIds(packsDir).filter(
    (p) => (!only || p === only) && fs.existsSync(path.join(packsDir, p, FILE)),
  );
  if (!packs.length) {
    console.log(`No Cost Plus snapshot files found (looked for ${rel(packsDir)}/*/${FILE}) — nothing to do.`);
    return 0;
  }

  let listing: CostPlusRow[] | null = null;
  const plans: { pack: string; file: string; next: CostPlusSnapshot; changed: boolean }[] = [];

  for (const pack of packs) {
    const file = path.join(packsDir, pack, FILE);
    const medsRead = readJsonFile(path.join(packsDir, pack, 'medications.json'));
    const snapRead = readJsonFile(file);
    const meds = medsRead.ok ? parseWith(medicationsSchema, medsRead.json) : null;
    const old = snapRead.ok ? parseWith(costPlusSnapshotSchema, snapRead.json) : null;
    if (!meds || !old) {
      console.error(
        color.red(
          `✖ ${pack}: ${!meds ? 'medications.json' : FILE} is missing or fails its schema — run npm run check:packs first.`,
        ),
      );
      return 1;
    }

    const targets = meds.medications.flatMap((m) =>
      m.strengths.flatMap((s) => (s.costPlusUrl ? [{ med: m, strength: s, url: s.costPlusUrl }] : [])),
    );
    console.log(color.bold(`${pack}: ${targets.length} strength(s) with a Cost Plus link`) + color.dim(` — ${API}`));
    if (!targets.length) continue;

    listing ??= await getRows(API);
    console.log(color.dim(`  listing: ${listing.length} products`));

    const quotes: Quote[] = [];
    const lines: Line[] = [];
    for (const t of targets) {
      const label = `${t.med.id} / ${t.strength.id}`;
      const matches = matchListing(listing, t.url);
      const row = matches[0];
      if (!row) {
        console.log(
          color.yellow(`warn  ${label}: ${t.url} is not in the API listing — skipped (check the costPlusUrl)`),
        );
        continue;
      }
      if (matches.length > 1)
        console.log(
          color.yellow(`warn  ${label}: ${matches.length} listing rows share that page; using NDC ${row.ndc}`),
        );
      if (!isPill(row) || t.strength.unitsPerCount !== 1) {
        console.log(
          color.yellow(
            `warn  ${label}: not a pill product (${row.form ?? '?'}) — quantity units are ambiguous, skipped`,
          ),
        );
        continue;
      }
      for (const qty of t.strength.quantities) {
        await sleep(PAUSE_MS);
        const url = `${API}?${new URLSearchParams({ ndc: row.ndc, quantity_units: String(qty) })}`;
        const quoteRow = (await getRows(url)).find((r) => r.ndc === row.ndc);
        const cents = dollarsToCents(quoteRow?.requested_quote);
        const units =
          quoteRow?.requested_quote_units !== undefined && quoteRow?.requested_quote_units !== null
            ? Number(quoteRow.requested_quote_units)
            : null;
        if (!quoteRow || cents === null || units !== qty) {
          const why =
            quoteRow?.error_message ??
            (quoteRow
              ? `no usable quote (${quoteRow.requested_quote ?? 'none'} for ${units ?? '?'} units)`
              : 'NDC missing from the answer');
          console.log(color.yellow(`warn  ${label} × ${qty}: ${why} — skipped`));
          continue;
        }
        const unit = dollars(quoteRow.unit_price ?? row.unit_price);
        const impliedFee = unit !== null ? cents - Math.round(unit * qty * 100) : null;
        quotes.push({
          medicationId: t.med.id,
          strengthId: t.strength.id,
          quantity: qty,
          priceCents: cents,
          productName: productName(quoteRow),
          url: t.url,
        });
        const feeOk = impliedFee !== null && Math.abs(impliedFee - old.formula.pharmacyFeeCents) <= 1;
        lines.push({
          label,
          qty: String(qty),
          price: `$${(cents / 100).toFixed(2)}`,
          fee: impliedFee === null ? '—' : `$${(impliedFee / 100).toFixed(2)}`,
          status: feeOk
            ? color.green('ok')
            : color.yellow(`fee ≠ formula ($${(old.formula.pharmacyFeeCents / 100).toFixed(2)})`),
        });
      }
    }

    if (lines.length) {
      console.log(
        table(
          ['Strength', 'Qty', 'Quote (before shipping)', 'Implied pharmacy fee', 'Check'],
          lines.map((l) => [l.label, l.qty, l.price, l.fee, l.status]),
        ),
      );
    }
    if (!quotes.length) {
      console.error(
        color.red(
          `✖ ${pack}: no quotes could be taken — nothing written. Check the costPlusUrls and the API answers above.`,
        ),
      );
      return 1;
    }

    const [first, ...rest] = old.sources;
    const next: CostPlusSnapshot = {
      ...old,
      snapshotDate: today,
      quotes,
      sources: [
        {
          ...(first ?? { name: 'Cost Plus Drugs public API', url: 'https://costplusdrugs.github.io/apidocs/' }),
          method: 'official-api',
          checkedOn: today,
          note: `Quotes from the Cost Plus Drugs public API (${API}?ndc=…&quantity_units=…) by scripts/snapshot-costplus.ts. Each quote includes markup and the pharmacy fee; shipping is extra.`,
        },
        ...rest,
      ],
      verifiedAsOf: today,
    };
    const check = costPlusSnapshotSchema.safeParse(next);
    if (!check.success) {
      console.error(color.red(`✖ ${pack}: the snapshot fails costPlusSnapshotSchema — nothing written:`));
      for (const line of formatZodIssues(check.error)) console.error(color.red(`    ${line}`));
      return 1;
    }
    const changed = JSON.stringify(old.quotes) !== JSON.stringify(quotes) || old.snapshotDate !== today;
    plans.push({ pack, file, next, changed });
  }

  console.log('');
  for (const p of plans) {
    if (!p.changed) console.log(color.green(`✔ ${p.pack}: already current — not rewritten.`));
    else if (args.has('dry-run'))
      console.log(
        color.cyan(`• ${p.pack}: would write ${p.next.quotes.length} quote(s) to ${rel(p.file)} (--dry-run).`),
      );
    else {
      writeFileAtomic(p.file, await formatJson(p.next, p.file));
      console.log(
        color.green(
          `✔ ${p.pack}: wrote ${p.next.quotes.length} quote(s) to ${rel(p.file)}. Next: npm run pack:manifest`,
        ),
      );
    }
  }
  return 0;
}

run(async () => {
  try {
    return await main();
  } catch (e) {
    if (e instanceof NetworkError) {
      console.log(color.yellow(`⚠ Skipping the Cost Plus snapshot: ${e.message}. Nothing was written.`));
      return 0;
    }
    throw e;
  }
});
