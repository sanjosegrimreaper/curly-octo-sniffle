#!/usr/bin/env node
/**
 * Screenshot routes of the web build (for reviewing screens without a simulator).
 *
 *   npx expo export --platform web            # builds dist/
 *   node scripts/shoot.mjs --route /find --name find
 *   node scripts/shoot.mjs --route /drug/apixaban/results --name results-dark --dark --lang es
 *   node scripts/shoot.mjs --shots shots.json          # many at once: [{ route, name, dark?, lang?, state?, width?, height?, textSize?, fullPage?, actions? }]
 *
 * Options: --dist dist  --out docs/screens  --width 390 --height 844  --full (full page)
 *          --state '{"rxb.screener.v1": {...}}'  (zustand persisted state objects, merged over defaults)
 *          --textSize larger   --highContrast   --reduceMotion
 *          --wait 1200 (ms after load)
 * Env: CHROMIUM path defaults to /opt/pw-browsers/chromium.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};

const dist = path.resolve(opt('dist', 'dist'));
const outDir = path.resolve(opt('out', 'docs/screens'));
fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error(`No web build at ${dist}. Run: npx expo export --platform web`);
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(dist, url);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const baseSettings = (o) => ({
  language: o.lang ?? 'en',
  themeMode: o.dark ? 'dark' : 'light',
  highContrast: !!o.highContrast,
  reduceMotion: o.reduceMotion ? 'on' : 'off',
  haptics: false,
  textSize: o.textSize ?? 'default',
  speechRate: 0.95,
  navigatorMode: false,
  clientLanguage: null,
  lowData: true,
  appLock: false,
  privateNotifications: true,
  lastOpenedAt: null,
});

let shots;
const shotsFile = opt('shots', null);
if (shotsFile) shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
else
  shots = [
    {
      route: opt('route', '/'),
      name: opt('name', 'screen'),
      dark: !!opt('dark', false),
      lang: opt('lang', 'en'),
      textSize: opt('textSize', 'default'),
      highContrast: !!opt('highContrast', false),
      reduceMotion: !!opt('reduceMotion', false),
      state: opt('state', null) ? JSON.parse(opt('state')) : {},
      width: Number(opt('width', 390)),
      height: Number(opt('height', 844)),
      fullPage: !!opt('full', false),
      wait: Number(opt('wait', 1200)),
    },
  ];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const errors = [];
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.width ?? 390, height: s.height ?? 844 },
    deviceScaleFactor: 2,
    colorScheme: s.dark ? 'dark' : 'light',
    reducedMotion: s.reduceMotion ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${s.name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${s.name}: console: ${m.text().slice(0, 300)}`);
  });
  const state = { 'rxb.settings.v1': baseSettings(s), ...(s.state ?? {}) };
  if (s.state?.['rxb.settings.v1']) state['rxb.settings.v1'] = { ...baseSettings(s), ...s.state['rxb.settings.v1'] };
  await page.addInitScript((st) => {
    for (const [k, v] of Object.entries(st)) localStorage.setItem(k, JSON.stringify({ state: v, version: 1 }));
  }, state);
  await page.goto(`http://localhost:${port}${s.route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(s.wait ?? 1200);
  for (const a of s.actions ?? []) {
    if (a.click) await page.getByTestId(a.click).first().click();
    if (a.clickText) await page.getByText(a.clickText, { exact: false }).first().click();
    if (a.fill) await page.getByTestId(a.fill.testID).first().fill(a.fill.value);
    if (a.wait) await page.waitForTimeout(a.wait);
    if (a.scroll) await page.mouse.wheel(0, a.scroll);
  }
  const file = path.join(outDir, `${s.name}.png`);
  await page.screenshot({ path: file, fullPage: !!s.fullPage });
  console.log('saved', path.relative(process.cwd(), file));
  await ctx.close();
}
await browser.close();
server.close();
if (errors.length) {
  console.log('\nPage errors:');
  for (const e of errors) console.log(' -', e);
}
