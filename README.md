# RxBridge

**Honest ways to pay less for your medicine.**

RxBridge is a free, private app (iOS, Android and web preview) for people who struggle to afford prescriptions. It helps them:
- find the lowest legitimate way to buy their medicine;
- check whether they may qualify for Medi-Cal, Covered California help, Medicare help or county programs;
- apply to free-medicine programs with a step-by-step call coach.

The first region is **Santa Clara County and Monterey County, California** (San José, Gilroy, Morgan Hill, Salinas). The launch languages are **English, Español, 中文（简体）, हिन्दी**.

No account, no ads, no tracking. Answers stay on the phone.

> ⚠️ **The data in this build is a draft.** The build environment's network policy blocked the official sources (fda.gov, dhcs.ca.gov, data.medicaid.gov, coveredca.com, costplusdrugs.com and others), so facts could only be seen in web-search results. Every one of them is labeled **"Not yet confirmed — call to confirm"** in the app, and the data pack's `manifest.status` is `draft`. See [VERIFICATION.md](VERIFICATION.md) and [How to confirm the data](#how-to-confirm-the-data).

## Status (October 2026)

| Area | State |
|---|---|
| **Screens** | All built in 4 languages (en, es, zh-Hans, hi): onboarding with the Bridge progress, Find, strength & quantity, Results (Prices / Help paying), My Plan, My medicines, Get help, Medicare, clinics, helpers, glossary, call coach, application tracker, pharmacist card, share/PDF, settings, navigator mode. |
| **Checks** | `npm run check` is green: TypeScript strict, ESLint, 343 Jest tests (domain property tests + component tests), i18n parity (1,062 keys per language), honesty lint, WCAG contrast (146 pairs), pack validation, verification report. |
| **Data** | Draft pack (`manifest.status: "draft"`). Facts were seen in search results only, because official sites were blocked from the build environment. Every one is labeled "Not yet confirmed". |
| **Web preview** | `npx expo export --platform web` works. Screens were reviewed through Playwright screenshots in `docs/screens/`. |

**Not tested on a real device yet:** Expo Go on iOS/Android, haptics, local notifications and the calendar editor, app lock (Face ID / fingerprint), keep-awake and brightness on the pharmacist card, the PDF share sheet, read-aloud voices, and location sorting.

**Known gaps, tracked in `RXBRIDGE_BUILD_PROMPT.md` v2:**
- **Data not filled yet.** No confirmed pharmacy store records (store locators were blocked). NADAC and Cost Plus snapshots are empty until the weekly GitHub Action runs with network access.
- **Prompt v2 changes still to implement:**
  - multi-select coverage (Medicare + Medi-Cal);
  - product/formulation variants with NDC lists;
  - integer price math (`perUnitE5`);
  - Intl polyfill detection;
  - Playwright E2E flows in CI;
  - authored Maestro flows.
- **Bundle size.** The web bundle is about 6 MB because the Lucide icon set isn't tree-shaken by Metro. Per-icon imports would shrink it.

## What's inside

| Area | What it does |
|---|---|
| **Screener** | Language → insurance → county → age (optional) → household → income → "you may be eligible" results. Income brackets are computed from the HHS poverty guidelines for the household size. The Bridge progress bar builds as you go. |
| **Find a medicine** | Typo-tolerant search in all four languages and scripts ("metfromin", "metformina", "二甲双胍", "मेटफॉर्मिन"), plus recent searches and common prescriptions. |
| **Prices** | Three price classes that are never mixed: **Buy now** (real checkout prices — mail order, maker's direct price, state-label insulin), **Coupons** (links only — we never show their amounts), and the **NADAC fair-price reference** (what pharmacies pay; you can't buy at it). Also the Price Ladder, show-the-math cards, and the generic outlook. |
| **Help paying** | Assistance programs matched to your household, income and coverage, grouped into "likely" and "worth checking". Each has the documents needed, the phone number and a call coach. |
| **My Plan** | Your next best steps, changes since your last visit, reminders and data freshness. |
| **My medicines** | Saved medicines, monthly budget (known prices only), refill reminders (private by default), optional app lock. |
| **Get help** | Medicare panel, county programs and clinics, free counselors, glossary, recent rule changes. |
| **Counter card & share** | A full-screen card to show the pharmacist (English plus your language), and a bilingual one-page PDF with a QR code. |
| **Navigator mode** | For community health workers: nothing is saved between clients, handouts in the client's language, and a "New client" button. |
| **Accessibility** | WCAG 2.2 AA target, 48dp tap targets, screen-reader labels, 200% text, high contrast, reduce motion, read-aloud in each language. |

## Run it

You need Node 22 and npm.

```bash
npm install
npx expo start        # scan the QR code with Expo Go (iOS/Android), or press w for the web preview
```

- **Device:** install **Expo Go**, then scan the QR code. Everything works in Expo Go; no custom native modules are needed.
- **Web preview:** `npm run web`, or build it with `npx expo export --platform web` (output in `dist/`).
- **Screenshots without a simulator:** `node scripts/shoot.mjs --route /find --name find` (uses Playwright + Chromium; see the header of the script for options).

## Checks

```bash
npm run typecheck       # TypeScript strict
npm run lint            # ESLint (expo config)
npm test                # Jest: domain logic, components
npm run check:packs     # data pack schema + honesty checks (sources, dates, cross-references, manifest hashes)
npm run check:i18n      # all languages have the same keys and placeholders
npm run check:honesty   # no "guaranteed", "you qualify", "will save"... in any language
npm run check:contrast  # WCAG contrast for every color token pair
npm run gen:verification  # regenerate VERIFICATION.md from the data pack
npm run check           # all of the above
```

CI (`.github/workflows/ci.yml`) runs these on every push. Weekly workflows refresh NADAC prices and the Cost Plus snapshot, and check every link.

## Data

All facts live in a versioned **data pack**: `data/packs/ca-south-bay/`.

| File | Contents |
|---|---|
| `region.json` | Counties, languages, partner domains, where to report problems |
| `fpl.json` | HHS poverty guidelines by year |
| `benefits.json` | Coverage rules (Medi-Cal, Covered California, Medicare, county programs) as data |
| `medications.json` | Medicines, strengths, pricing units, aliases in each language, partner links |
| `programs.json` | Assistance programs: income cap (% FPL), insurance rule, documents, phone |
| `outlook.json` | Generic/biosimilar outlook per medicine, with its basis |
| `prices/costplus.json`, `prices/nadac.json`, `prices/direct.json` | Price snapshots (filled by scripts) and direct prices |
| `pharmacies.json`, `clinics.json`, `helpers.json` | Places and people who help |
| `notices.json`, `facts.json`, `glossary.json` | Rule changes, small facts (e.g. Medicare caps), plain-language definitions |
| `manifest.json` | Pack version, status (`draft` / `release`), file hashes |
| `unverified.json` | Things we looked for but could not confirm (not shipped) |

Every record carries `sources` (name, URL, method, date checked) and `verifiedAsOf`. Zod schemas in `src/data/schemas.ts` validate the pack at build time (`npm run check:packs`) and again when the app loads.

### Honesty rules
- **Never invent anything.** That covers prices, pharmacies, addresses, hours, phones, URLs, programs, rules and dates.
- **Every fact on screen has a source chip.** Tap it to see where the fact came from, when it was checked and how.
- **Unknown stays unknown:** "Not listed", "Price not loaded yet", "Call to confirm".
- **Hedged language:** "may qualify", "could drop". Never "you qualify" or "guaranteed".
- **No medical advice.** The app only suggests questions to ask a doctor or pharmacist.

### How to confirm the data
1. Give the environment network access to the official sites. In Claude Code on the web, open the environment's settings, then **Network access** → Custom → add the domains. On GitHub Actions the network is open already.
2. Open each source URL in `VERIFICATION.md` and check the value. In the record, set `method` to `http-200` or `browser-confirmed` (or `official-pdf`, `official-data-file`, `official-api`), and update `checkedOn` and `verifiedAsOf`.
3. Run `npm run refresh:nadac`, `npm run snapshot:costplus`, `npm run pack:manifest` and `npm run gen:verification`.
4. Once nothing is `unconfirmed`, set `manifest.status` to `release`. `npm run check:packs -- --release` must pass.

### Add a medicine
1. Add a record to `medications.json`: strengths with `pricingUnit` and `unitsPerCount`, aliases in every language, and partner URLs.
2. Add its outlook to `outlook.json`, and add or link its programs.
3. Run `npm run pack:manifest && npm run check:packs`.

### Add a region
1. Copy `data/packs/ca-south-bay/` to `data/packs/<new-id>/` and replace the content.
2. Register it in `PACK_FILES` in `src/data/pack.ts`.

No screen code changes are needed.

### Add a language
1. Add it to `LAUNCH_LANGUAGES` / `LANGUAGES` in `src/i18n/languages.ts`.
2. Copy `src/i18n/locales/en/` to `src/i18n/locales/<lang>/` and translate. Register the files in `src/i18n/resources.ts`.
3. Add the language to each localized field in the pack.
4. Run `npm run check:i18n`.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: routes are in `src/app/`, the design system in `src/design/`, pure tested logic in `src/domain/`, data loading in `src/data/`, state in `src/state/`, and translations in `src/i18n/`.

## Assumptions
- **Region by county, not district.** After Proposition 50 (2025), Gilroy and Salinas sit in CA-18, so the region uses Santa Clara and Monterey counties.
- **Draft data until confirmed.** Facts that couldn't be opened on official pages ship labeled "Not yet confirmed".
- **No store-level pharmacy data yet.** "Find pharmacies near you" opens the phone's Maps app, and county health-center pharmacies are listed.
- **Plain SVG instead of Skia.** Animations use react-native-svg + Reanimated rather than Skia, so the web preview needs no WebAssembly hosting.
- **Small feed service instead of TanStack Query.** Remote price feeds use a small feed service with a persisted cache; the only remote feed is NADAC.
- **Storage.** Persistence uses AsyncStorage, which works in Expo Go and on the web. MMKV can be swapped in for dev builds.

## License and credits
- **Fonts:** Fredoka and Atkinson Hyperlegible Next (SIL Open Font License).
- **Icons:** Lucide (ISC).
- **Not affiliated:** RxBridge is not affiliated with GoodRx, SingleCare, Mark Cuban Cost Plus Drugs, Covered California, Medi-Cal / DHCS or any drug maker. Their names are used only to say where to look.
