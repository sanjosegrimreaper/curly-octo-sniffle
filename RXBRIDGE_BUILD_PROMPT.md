# RxBridge — Master Build Prompt (v2)

> **How to use this file**
> 1. Edit the **Knobs** block (§0) and anything marked `[TWEAK]`. Delete what you don't want.
> 2. Fix the environment first (§0.1). Without network access to official sites, every fact ships as "Not yet confirmed".
> 3. Start a Claude Code session on this repo and say: *"Build (or continue building) the app described in RXBRIDGE_BUILD_PROMPT.md."*
>
> **v2 changes:** this version folds in research done on 2026-10-06 (§9.4) and two independent reviews (engineering; product, honesty and accessibility). The biggest changes:
> - The region is defined by county.
> - The price classes are new.
> - Generic outlook needs a market-entry basis, not just patent dates.
> - Formulation variants and unit math are explicit.
> - A draft/release data workflow is added.
> - There is a privacy and app-store section.
> - The web-based verification loop for agents without simulators is spelled out.

---

## 0. Knobs `[TWEAK]`

```yaml
app_name: RxBridge
tagline: "Honest ways to pay less for your medicine."   # never promise "lowest"
first_region: ca-south-bay            # Santa Clara County + Monterey County. COUNTY is the unit — never congressional
                                      # districts (after Prop 50, Gilroy/Morgan Hill/Salinas are in CA-18, not CA-17/19)
launch_languages: [en, es, zh-Hans, hi]   # [TWEAK] decide with Census ACS table C16001 ("speaks English less than very
                                      # well") for both counties + DHCS threshold languages. Vietnamese (large in San José)
                                      # and Tagalog may outrank Hindi; many older Chinese readers prefer Traditional (zh-Hant).
next_languages: [vi, tl, zh-Hant]     # architecture must support these; fonts: system font for vi (see §5.3)
slice_drugs:                          # vertical slice: one of each kind
  - metformin ER                      # cheap generic — with formulation variants (regular ER vs osmotic vs modified)
  - apixaban (Eliquis)                # brand; no US generic until ≥ 2028-04-01 per settlements; maker's direct price;
                                      # sold by Cost Plus since Apr 2026; BMS Patient Assistance Foundation
  - insulin glargine                  # biologic; interchangeable biosimilars; CalRx/Civica price cap; $35/month programs
full_drug_list_size: 40               # only after the slice is approved
medicare_branch: true
age_question: true                    # "Is the medicine for someone 65 or older?" (Medicare help + Medi-Cal rule set)
county_question: true                 # needed for county programs (Santa Clara PCAP), clinics, helpers
navigator_mode: true
read_aloud: true
app_lock: true
pause_for_review_after_slice: true
feeds_base_url: null                  # e.g. https://<user>.github.io/rxbridge-feeds — hosts nadac.json (+ schemaVersion)
feedback_url: null                    # issue form / web form for "Report a problem" and "Ask us to add a medicine"
feedback_email: null                  # if both feedback_* are null, hide those buttons and show free local help instead
bundle_id: null                       # e.g. org.example.rxbridge — required before store builds
eas_owner: null
share_base_url: null                  # optional https page that a shared QR code opens for people without the app
```

**Where each knob is used:**

| Knob | Used in |
|---|---|
| `app_name`, `tagline` | Welcome screen, app.json, store listing |
| `first_region` | `data/packs/<first_region>/` |
| `launch_languages` | `LAUNCH_LANGUAGES` in `src/i18n/languages.ts` (§10) |
| `medicare_branch`, `age_question`, `county_question`, `navigator_mode`, `read_aloud`, `app_lock` | `src/config/flags.ts`. When a flag is off, its entry points are hidden. |
| `feeds_base_url` | app.json `extra.feeds` |
| `feedback_*` | `region.json` (`reportProblemUrl` / `reportProblemEmail`) |
| `bundle_id`, `eas_owner` | app.json, eas.json |
| `share_base_url` | the PDF/QR (§7.15) |

### 0.1 Environment prerequisites (do this before building) `[TWEAK]`
The build agent must be able to open official pages, or no fact can be confirmed.

In Claude Code on the web, open the environment's settings, then **Network access**. Choose a broader level, or Custom with these domains allowed:
- **Federal:** federalregister.gov, govinfo.gov, aspe.hhs.gov, data.medicaid.gov, download.medicaid.gov, medicaid.gov, cms.gov, medicare.gov, ssa.gov, fda.gov, accessdata.fda.gov, purplebooksearch.fda.gov, findahealthcenter.hrsa.gov, data.hrsa.gov, api.census.gov.
- **California state:** dhcs.ca.gov, medi-calrx.dhcs.ca.gov, benefitscal.com, coveredca.com, hbex.coveredca.com, aging.ca.gov, calrx.ca.gov, gov.ca.gov, leginfo.legislature.ca.gov, pharmacy.ca.gov.
- **Counties:** santaclaracounty.gov (and its subdomains), scvh.org, countyofmonterey.gov, natividad.com.
- **Drug programs and pharmacies:** costplusdrugs.com, costplusdrugs.github.io, goodrx.com, singlecare.com, bmspaf.org, eliquis.bmscustomerconnect.com, lillycares.com, insulins.lilly.com, sanofipatientconnection.com, lantus.com, civicainsulin.org, rxassist.org, needymeds.org, and the chain store locators (cvs.com, walgreens.com, safeway.com, costco.com, walmart.com).

Keep the default package-manager list allowed. If web search has a per-session budget, raise it (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`).

If official pages are still unreachable, do not stall. Ship facts as `unconfirmed` in a `draft` pack (§2.9) and list what's blocked.

---

## 1. Your role and the bar

You are a senior mobile engineer, product designer and motion designer. Build **RxBridge**: a cross-platform Expo app (iOS and Android, plus a web preview) for people who struggle to afford prescriptions. It helps them find honest ways to pay less for their medicine and see whether they may qualify for public coverage, county programs or free-medicine programs.

**The bar:** an Apple Design Award finalist that happens to be a public-good tool.
- **Delight:** bright, warm, fluid and delightful.
- **Simplicity:** calm, honest and dead simple for a 70-year-old on a cracked Android phone with spotty data.
- **Craft:** every screen good enough to proudly screenshot.

It is **not** a storefront, a marketing site or a coupon funnel. No ads, no affiliate links, no subscriptions, no accounts, no analytics, and no AI chatbot inside the app.

**Existing code:** if this repo already contains the RxBridge scaffold (Expo SDK 57, `src/app`, `src/domain`, `data/packs`, `scripts/`), read `AGENTS.md`, `docs/ARCHITECTURE.md` and `README.md` first. Extend the scaffold; don't rewrite it. Where this file and the code disagree, this file wins, and you update the code. If the repo is empty, build from scratch following §14.

### Failure modes to avoid (seen in earlier attempts)
- **UI and copy**
  - Flat, generic UI with no personality or motion.
  - Placeholder copy ("APP NAME", "Lorem", "TODO").
  - Income ranges labeled inconsistently. Buttons labeled with one program's name that open another program's site.
- **Structure**
  - An ad-hoc screen state machine instead of real navigation, which breaks back gestures and deep links.
  - Hard-coded UI strings and hard-coded income brackets.
  - Household size capped at 5. FPL years that don't match the program using them.
- **Honesty**
  - Facts with no source or date.
  - "Verifying" facts from memory.
  - A "generic within 12 months" message based on a patent date when settlements block launch.
  - Ranking a different product (biosimilar, other formulation) as "the lowest price" for the person's medicine.

---

## 2. The Honesty Contract (non-negotiable; overrides everything else)

1. **Never invent anything.**
   - That covers prices, pharmacies, addresses, hours, phones, URLs, programs, eligibility rules, market-entry dates, statistics and translations of legal terms.
   - Facts recalled from training data are not verified.
   - Can't confirm it? Don't ship it as confirmed. List it in `data/packs/<id>/unverified.json` and in VERIFICATION.md.
2. **Every fact on screen carries a source chip.** It shows the source name, link and "Checked on {date}". Tapping it opens a sheet with how it was checked and a "Report a problem with this" action. Any sentence that states a fact about a program, law or price lives in the pack (`facts.json`, `notices.json`, ...) with sources. Locale files hold only UI wording.
3. **Unknown is a first-class state.** Use "Not listed", "Price not loaded yet" and "Call to confirm". An honest empty state beats a filled-in guess.
4. **Price classes are never blended.** Each has its own type, visual treatment and copy:

   | Class | What it is | Treatment |
   |---|---|---|
   | **buyNow** | An exact checkout price anyone with a prescription can pay, for this exact product and quantity. `seller: 'pharmacy' \| 'manufacturer'` plus a required `restrictions[]` that is always shown (e.g. `notWithMedicarePartD`, `mailOrderOnly`, `soldInPacksOf`). | Mint tint card with a mint border |
   | **priceCap** | A published maximum, e.g. state-label insulin "up to $55 for 5 pens". | Always "Up to $X". Never ranked, never called lowest. Mint outline. |
   | **programPrice** | A price you get only if you sign up and qualify, e.g. a $35/month insulin program. | Always "If you sign up and qualify: $35 a month". Lilac. Lives in Help paying; may appear in the Price Ladder as a row with no bar. |
   | **coupon** | A link to GoodRx / SingleCare. **No amount field exists in the type.** | Sky outline card, link-out icon |
   | **reference** | CMS NADAC: what pharmacies pay on average. Nobody can buy at it. | Slate card with a hatched leading band; "What pharmacies pay (for comparison)" |

   Medicare negotiated prices (what plans pay) are **reference-like facts**, never a price the person pays.
5. **Hedged language only:** "may", "could", "might". Never "you qualify", "likely qualify", "eligible" (unhedged), "guaranteed", "will save", "approved", "lowest price", "best price" or "cheapest". The honesty linter (§11) enforces this in every language.
6. **No medical advice.**
   - Never suggest switching products, changing a dose, splitting pills, shorter fills or stopping a medicine.
   - Only "Ask your doctor or pharmacist ..." questions.
   - Outlook copy ends with "Keep taking your medicine as your doctor told you."
7. **Show the math** wherever a number is computed (unit price × quantity, % FPL → dollars).
8. **Ask only for what's needed.** Never ask about immigration status, SSN or identity. Don't say "your answers stay on this phone" (backups and other users exist). Say what's true (§11).
9. **Never present a different product as the person's product.** Biosimilars, other formulations and other brands are grouped as "Different versions of this medicine — ask your pharmacist if your prescription allows them". They get no ribbon and no "lowest".
10. **Never imply cash beats the person's coverage.** People with Medicare or Medi-Cal see a coverage banner first (§7.8).
11. **Draft vs release.** Each source has a `method`. Confirmed methods: `http-200` (URL facts only), `browser-confirmed`, `official-pdf`, `official-data-file`, `official-api`, `phone-confirmed`.
    - A method may be recorded only for a source actually opened in this session (record what you saw). `browser-confirmed` and `phone-confirmed` are recorded by humans.
    - For non-URL facts, a confirmed source also needs `excerpt` (a short verbatim quote) and `locator` (section or heading).
    - Anything else is `unconfirmed`, with a `note` saying why (e.g. "seen only in search results; network blocked").
    - The pack manifest has `status: 'draft' | 'release'`. In a draft pack, unconfirmed facts render with a sunflower "Not yet confirmed — call to confirm" chip and a persistent Preview-data banner. `validate-packs --release` fails on any unconfirmed source.
12. **Time-bound facts carry a window:** `effectiveFrom`, `effectiveTo?`, `planYear?`. Examples are the Part D cap, state subsidy bands, FPL years and enrollment dates. Show the fact whose window contains today. CI fails when a fact's `effectiveTo` is before the build date. No current fact → show the latest with its year label and a stale chip.

Encode the contract in types:

```ts
type ISODate = string & { readonly __brand: 'ISODate' }; // YYYY-MM-DD, a calendar date with no time zone
type VerificationMethod = 'http-200' | 'browser-confirmed' | 'official-data-file' | 'official-pdf' | 'official-api' | 'phone-confirmed' | 'unconfirmed';
type SourceRef = { name: string; url: string; method: VerificationMethod; checkedOn: ISODate; edition?: string; excerpt?: string; locator?: string; note?: string };
type Sourced<T> = { value: T; sources: [SourceRef, ...SourceRef[]]; verifiedAsOf: ISODate; effectiveFrom?: ISODate; effectiveTo?: ISODate };

type BuyNow = { class: 'buyNow'; seller: 'pharmacy' | 'manufacturer'; sellerName: string; productId: string; amountCents: number; quantity: number; restrictions: Restriction[]; shippingExtra: boolean };
type PriceCap = { class: 'priceCap'; productId: string; maxCents: number; per: Localized };
type ProgramPrice = { class: 'programPrice'; programId: string; amountCents: number; per: Localized; whoCanUse: Localized };
type Coupon = { class: 'coupon'; partner: 'goodrx' | 'singlecare'; url: string }; // no amount, by design
type Reference = { class: 'reference'; perUnitE5: number; pricingUnit: 'EA' | 'ML' | 'GM'; units: number; asOf: ISODate; effective: ISODate };
```

---

## 3. People we're designing for

| Person | Situation and needs |
|---|---|
| **Rosa, 62, Salinas** | Reads Spanish first, uninsured, does seasonal farm work (monthly income varies). Takes metformin ER. Android phone with limited data; slow to trust an app. |
| **Wei, 74, San José** | Reads Chinese first (may prefer Traditional `[TWEAK]`); on Medicare. A daughter set up the phone; Wei uses it alone, with large text and sometimes VoiceOver. |
| **Anjali, 38, Gilroy** | Caregiver for a parent; switches between Hindi and English. Needs to share a summary with a sibling. `[TWEAK]` Replace with a Vietnamese-speaking persona if ACS data says so. |
| **Marcus, community health worker** | Sees 12–15 clients a day in several languages. Needs speed, no data left behind, and a bilingual handout. |

**Design principles**
1. **One job per screen.** One question or decision, one primary button.
2. **Never a dead end.** Every empty or error state offers a next step, and "Get free help" is always reachable (WCAG 3.2.6).
3. **Show your work.** Math and sources are one tap away.
4. **Calm first, delight second.** Animation explains change. Nothing flashes; no sparkles.
5. **Same answer in every language.** Switching language changes words, never state.
6. **Built for the worst phone.** Small screen, 200% text, no data, TalkBack on, a shared phone.
7. **Never ask twice** (WCAG 3.3.7). Prefill every repeated answer.

---

## 4. Platform and stack (pinned)

**Pinned versions:** **Expo SDK 57** (expo ~57.0.x, React Native 0.86, React 19.2, New Architecture, Hermes), TypeScript 6 strict with `noUncheckedIndexedAccess`.
- Versions are pinned in package.json. Add packages only with `npx expo install` (use `EXPO_OFFLINE=1` if expo.dev is blocked; it uses the bundled version table).
- Never write Expo API shapes from memory. Read the installed `node_modules/<pkg>/build/*.d.ts`, or the versioned docs if reachable.

| Concern | Choice | Notes |
|---|---|---|
| Navigation | Expo Router 57, typed routes, routes in `src/app/` | Root native Stack; tabs = **headless tabs from `expo-router/ui`** (TabList/TabTrigger/TabSlot) with a custom floating bar. Never `Tabs` from 'expo-router' (deprecated; `expo-router/js-tabs` if a stock bar is needed). No NativeTabs (unstable). |
| Animation | react-native-reanimated 4.5 + react-native-worklets | Don't add a Babel plugin (babel-preset-expo configures `react-native-worklets/plugin`). React Compiler is on: prefer `sv.get()`/`sv.set()`. Layout animations (`entering`/`exiting`), `useAnimatedProps` for SVG. No `sharedTransitionTag` (needs a native flag; not in Expo Go) — use a 200 ms fade-through. |
| Custom drawing | **react-native-svg** + Reanimated | Graph paper (SVG `<Pattern>`), Bridge, Price Ladder, Freshness Ring, illustrations. No Skia: CanvasKit wasm complicates web, Jest and bundle size. |
| Lists | @shopify/flash-list 2 (or plain `map` for short lists) | |
| State | Zustand + `persist(createJSONStorage(() => AsyncStorage))` | AsyncStorage = localStorage on web. No SQLite, no MMKV. Each store: `name 'rxb.<store>.v1'`, `version`, `migrate`. |
| Remote data | A small feed client (no TanStack Query) | Only remote feed: NADAC. `fetchJson` with 6 s timeout + retries; keep the last valid feed. |
| Validation | Zod 4 | Packs, feeds, deep-link params |
| i18n | i18next 26 + react-i18next 17, JSON v4 plural suffixes, `{{name}}` interpolation | No i18next-icu. Intl polyfills only if feature detection fails (§10). |
| Icons | lucide-react-native | Always paired with text, except the documented icon-only set (§12) |
| Fonts | @expo-google-fonts/fredoka (headings, Latin), @expo-google-fonts/atkinson-hyperlegible-next (body, prices) | System fonts for zh/hi/vi (§5.3) |
| Device | expo-haptics, expo-speech, expo-print, expo-sharing, expo-location, expo-notifications (local only), expo-calendar (**`expo-calendar/legacy`** + `createEventInCalendarAsync`, which needs no permission), expo-web-browser, expo-local-authentication, expo-keep-awake, expo-brightness, expo-network, expo-localization | Each `src/services/*` exports `isAvailable()` and degrades on web (hide unavailable actions; the web export must not throw on any screen). |
| QR | `qrcode` (SVG string) | |
| Testing | jest-expo + @testing-library/react-native + fast-check; **Playwright against the web export** (runs in the container); Maestro flows authored for devices | §13 |
| Quality | ESLint 9 flat (`eslint-config-expo/flat` + prettier), Prettier, `tsc --noEmit` | eslint-plugin-react-native-a11y only if it loads under flat config; otherwise use a11y assertions in component tests. |
| Builds | EAS (development / preview / production) | iOS permission strings localized via app.json `locales` |

**Feature flags:** they live in `src/config/flags.ts`. A native-only feature (e.g. label scan) turns on only outside Expo Go (`Constants.executionEnvironment !== 'storeClient'`) and when `requireOptionalNativeModule(...)` exists. It is loaded with `require()` inside the flagged branch, never as a top-level import in a route.

---

## 5. Design language — "Daybreak"

**The concept is sunlight through a pharmacy window:** bright, optimistic and clean, but every color has to earn its place. Big calm surfaces; saturated color only in small doses. **Every bright color carries a meaning.**

### 5.1 Color tokens
These are validated by `scripts/contrast-check.ts` over an explicit `contrastPairs` list exported from `tokens.ts`.
- **Text:** ≥ 4.5:1.
- **Non-text UI and graphics:** ≥ 3:1 (WCAG 1.4.11).
- **High contrast:** ≥ 7:1.

**Light theme**

| Token | Value | Use |
|---|---|---|
| bg | `#EEF6FF` | Sky wash |
| grid / gridMajor | `#3B82F6` @ 7% / 12% | Graph paper (decorative) |
| surface / surfaceSunken | `#FFFFFF` / `#F5F9FE` | Cards / wells |
| border | `#D5E1EF` | Decorative card edges only |
| **borderStrong** | `#64748B` (4.76:1) | Inputs, unselected chips, steppers (must be ≥ 3:1) |
| text / textMuted | `#0F172A` / `#475569` | |
| accent / accentSoft / accentInk / onAccent | `#4F46E5` / `#E0E7FF` / `#3730A3` / `#FFFFFF` | Primary actions |
| focus | `#1D4ED8` 3dp ring | ≥ 3:1 on bg and surface |

**Signals:** each has `fill` (decorative only), `solid` (bars, rings, progress: ≥ 3:1 on surface), `tint` (backgrounds) and `ink` (text and icons: ≥ 4.5:1 on surface and tint).

| Signal | Meaning | fill | solid | tint | ink |
|---|---|---|---|---|---|
| mint | buy now, success | #20C997 | #0CA678 | #E6FCF5 | #087F5B |
| sky | coupons, info | #339AF0 | #1C7ED6 | #E7F5FF | #1864AB |
| lilac | programs, coverage | #9775FA | #7950F2 | #F3F0FF | #6741D9 |
| tangerine | generic outlook | #FF922B | #E8590C | #FFF4E6 | #C2410C |
| sunflower | caution, stale, unconfirmed | #FCC419 | #D97706 | #FFF9DB | #8A5A00 |
| coral | closed, error | #FF6B6B | #FA5252 | #FFF5F5 | #C92A2A |
| slate | reference | #94A3B8 | #64748B | #F1F5F9 | #334155 |

**Dark and high contrast:**
- **Dark:** bg `#0B1020`, surface `#131A2E`, borderStrong `#8090AB`, lighter inks (validated).
- **High contrast:** no grid, no tints behind text, 2dp borders, inks ≥ 7:1, darker accent (`#1E1B6E` on white).

**Never by color alone.** Every status has text and an icon. Selected chips get a check plus a 2dp accent border.

### 5.2 Shape, depth, spacing
- **Spacing:** 4/8/12/16/24/32/48.
- **Radius:** 12, 20, 28, pill.
- **Cards:** white, decorative border and soft accent-tinted shadow.
- **Primary button:** 56dp.
- **Tap targets:** ≥ 48dp with non-overlapping hit areas.
- **Card anatomy:** label → big value → package → note → source chip.
- **Hatch:** the reference hatch sits only in a 12dp leading band (and the ladder mark), never behind text.

### 5.3 Typography
- **Families:** headings Fredoka 600; body Atkinson Hyperlegible Next.
- **Prices and numerals:** Atkinson Hyperlegible Next with `fontVariant: ['tabular-nums']` in every locale (it has `tnum`; Fredoka doesn't).
- **Font stacks per locale** (config in one place):
  - en/es/tl: Fredoka for headings, Atkinson for body.
  - zh-Hans/zh-Hant/hi/**vi**: system fonts (Fredoka and Atkinson lack CJK, Devanagari and Vietnamese diacritics).
  - Hindi line-height ≥ 1.6.
- **Text size:** effective scale = `min(OS fontScale × in-app textSize, 2.0)`, applied via one `useType()` hook. No fixed heights on text.

### 5.4 Illustration and brand
- **App icon:** an indigo bridge arcing over a mint/lilac capsule on a daybreak sky (peach → sky gradient, faint graph paper). Adaptive and monochrome variants.
- **Spot illustrations:** flat geometric SVGs in the signal palette: pill bottle, bridge, storefront, phone, folder, map pin, calendar, magnifier, shield. No people, no real-looking pills or brand logos.

### 5.5 Motion system
- **Tokens:** `fast 120`, `base 200`, `slow 320`, `celebrate 600` ms; easing `cubic-bezier(.2,0,0,1)`; one spring.
- **Rules:**
  - Motion explains where things came from.
  - Nothing flashes more than 3 times a second.
  - No sparkles, no 3D rotations, no parallax.
  - A loading shimmer stops after 5 s and shows "Still loading…".
  - Native stack transitions are exempt from timing rules.
- **Reduce Motion** (follows the OS; overridable): crossfades ≤ 150ms, final states rendered directly.
- **Press feedback:** scale 0.97 + a haptic tick (respects the setting; none on web).

### 5.6 Signature moments
1. **The Bridge.** A progress bar across the screener, built from SVG planks. It has one plank per step **on the person's current path**, and "Step N of M" is recomputed when the path changes. On the result, the arc completes and a small dot walks across once. Exposed as `accessibilityRole="progressbar"`.
2. **People row.** On the household screen, the stepper adds and removes person glyphs with a spring.
3. **Price Ladder.** One chart on a shared scale.
   - **buyNow:** options for the person's exact product as bars in `solid` mint.
   - **Reference:** a hatched slate tick labeled "What pharmacies pay".
   - **Rows with no bar:** coupons ("See prices on GoodRx / SingleCare"), program prices ("If you sign up: $35 a month") and price caps ("Up to $55").
   - **Ribbon:** "Lowest listed online price — checked {date}. Coupons or insurance may cost less." It appears only when there are ≥ 2 comparable buyNow options for the same product with different prices, the snapshot is ≤ 30 days old, and the person doesn't have Medicare or Medi-Cal.
   - A text equivalent is always provided.
4. **Odometer prices.** Rolling tabular digits, hidden from screen readers, which hear the final price once.
5. **Show the math.** A "Show the math" text button expands the arithmetic below the price (exposed as expanded state). The card itself is never pressable, so there are no nested controls.
6. **Freshness Ring.** Drains as data ages relative to that data type's stale threshold (§9.5). Always has text.
7. **Save burst.** The save star fills with a small radial burst plus a success haptic. No flashing.
8. **Splash.** The bridge arc draws in over the first screen (≤ 700ms); any tap skips it; Reduce Motion skips it.

---

## 6. Information architecture

**Paths:**

| Answer | Path |
|---|---|
| No / Not sure | Welcome → Coverage → Where (county) → Age → Household → Income → Result |
| Job / Covered CA / Other | Welcome → Coverage → Type → Checklist → (offer "Check if you can get more help — 2 questions") → Find |
| Medi-Cal | Welcome → Coverage → Type → Medi-Cal explainer (+ notices) → Find |
| Medicare | Welcome → Coverage → Type → Medicare panel (+ "Check if you can get Extra Help") → Find |
| "Just search for a medicine" | Welcome → Find (Help paying then shows every open program as "to check", with "Answer 3 questions to sort these") |

**Tabs** (headless, custom bar):
- **My Plan:** next steps, saved medicines, reminders, freshness.
- **Find:** search, then strength & quantity, then Results (Prices | Help paying).
- **My medicines:** saved list, per-fill budget, reminders.
- **Get help:** coverage check, applications, Medicare, clinics, free help, glossary, rule changes.

**Root stack** (above the tabs):
- `drug/[id]` and `drug/[id]/results`;
- `program/[id]`, `call-coach/[id]`, `applications`;
- `medicare`, `clinics`, `helpers`, `glossary`, `settings/*`;
- `counter-card` (`fullScreenModal`) and `share` (modal).

**Sheets** (Source, Glossary) close with a Close button, Android back and Escape.

**Resume:** persist the answers and `lastRoute`. After every store has hydrated (keep the splash until then), `router.replace` to it. Don't persist the stack or scroll position. "Start over" appears in My Plan and Settings.

---

## 7. Screens
For each screen, the spec covers its job, copy, states, motion and accessibility. Copy is grade 6–8, and the replacement wording below is binding.

### 7.1 Welcome + Language
- Language buttons in their own script, no flags. The list shown is `region.languages ∩ bundled locales`.
- **Purpose line:** "{tagline}". **Privacy line:** "We don't collect your answers. They're saved only in this app, on this phone."
- **Get started** (primary); **Just search for a medicine** (secondary).
- Language changes re-render instantly with a crossfade.
- **Device-locale mapping:** zh-TW/zh-HK/zh-Hant* → zh-Hant if shipped, else zh-Hans with a one-time notice.

### 7.2 Coverage
- **Question:** "Do you have Medi-Cal, Medicare, or other health coverage right now?" Yes / No / Not sure.
- **Yes** → "What kind? (choose all that apply)": Medi-Cal · Medicare · From a job · Covered California · County program (like PCAP) · Other / not sure. Multi-select handles dual Medicare + Medi-Cal.
- **Job / Covered CA / Other** → a plain checklist:
  - "Call the member phone number on your insurance card. Ask: Do you cover {medicine}? How much will I pay? Which pharmacies can I use?"
  - Glossary chips: copay, deductible, formulary.
  - The Copay Check lives in Results, per medicine, not here.
  - "Other / not sure" → "Find out what coverage you have" with verified phone numbers.
- **Medi-Cal** → explainer with no unverified claims:
  - "If you have full Medi-Cal, most prescriptions may be covered through Medi-Cal Rx. Not sure what your Medi-Cal covers? Ask your pharmacy." (Add the Medi-Cal Rx phone once verified.)
  - Plus the Medi-Cal notices.
- **Medicare** → Medicare panel (§7.10).

### 7.3 Where, Age, Household
- **Where:** "Where do you live?" with region counties (each with example cities) + "Somewhere else".
- **Age:** "Is the medicine for someone 65 or older?" Yes / No / Skip. "We ask so we can show Medicare help and the right Medi-Cal rules."
- **Household:**
  - Big stepper with the People row.
  - Helper: "Count you, your husband or wife, and anyone you claim on your taxes." `[verify the non-filer rule with DHCS]`
  - "8 or more" requires the exact number, prefilled with 8, range 8–20.

### 7.4 Income
- **Default unit is Monthly.** Toggle Monthly / Yearly; the other unit shows below.
- **Question:** "How much money does your household get each month, before taxes?" Helper: "If your pay changes a lot, use what you expect this month. Covered California uses what you expect for the whole year."
- **Brackets** are (lo, hi] in dollars, computed per rule with that rule's FPL year (or the program's published chart, §8). Edges within $1 merge. Show at most 5, relevant to this person's path.
- **Labels:** "$X or less a month" · "$X+1 to $Y a month" · "More than $Y a month" (and "a year").
- **"Type my exact income"** is equally prominent.
- **Near a limit** (|income − limit| ≤ 5% of the limit):
  - Under: "You're close to an income limit. Apply anyway — the program decides."
  - Over: "You're a little over the limit we show. Some income may not count. You can still apply — the program decides."
- **"Skip this question"** skips sorting; everything else still works.

### 7.5 Coverage result
The Bridge completes (calmly if no card applies).

**Cards:** each has a dollar limit for this household and its FPL year, next steps, link buttons named for their destination, notices inline and source chips.

| Card | Copy and links |
|---|---|
| **Medi-Cal** | Title: "You may be able to get Medi-Cal". Inline 2026 notice: "New rules started in 2026. Some adults 19 and older can't sign up for full Medi-Cal right now. We don't ask about this — the county decides. You can still apply." 65+: "Medi-Cal may also count your savings and property." Buttons: "Apply on BenefitsCal" · "Apply by phone" (verified) · "Get free help applying". |
| **Covered California** | Title: "For coverage in {planYear}: you may be able to get help paying for a Covered California plan". Notes: "If you can get insurance from a job, you may not get this help." "You can sign up from {start} to {end}. Other times, only after a big life change." Above 400% FPL (cliff): "People earning more than $X a year may not get help with monthly costs." |
| **County (Santa Clara PCAP)** | Title: "Santa Clara County may help you pay for care and medicine". Monterey: only verified programs; otherwise "Clinics that charge less if you earn less". |
| **Other ways to get coverage** | When nothing applies: Covered California link (no help claim) plus free helpers. |

- Never render `notLikely` for public programs. Say "Other ways to qualify may apply. You can still apply."
- Always end with: "This is not a decision. Only the program can say yes or no."
- **Primary:** "Compare prices for my medicine". **Secondary:** "Go to My Plan".

### 7.6 Find medicine
- **Search field:** no autofocus (it hides the grid and confuses TalkBack).
- **Lists:** recent searches with a "Clear all" (off in navigator mode); "Common prescriptions" with **neutral** category chips (icon + text).
- **Matching:** across languages and scripts (Traditional aliases too) and typos.
- **Results** list each product variant separately when variants exist.
- **Not found:** "We can't find that. Try the medicine name on your pill bottle label." Offer "See prices on GoodRx" (search link) · "Questions for your pharmacist" · "Get free help" · "Ask us to add this medicine" (only if `feedback_*` is set).

### 7.7 Product, strength & quantity
- **Variant step:** asked only when variants exist, e.g. "Does your label say OSM or osmotic?" or Lantus / unbranded / CalRx glargine-yfgn / Basaglar …
- **Labels as printed** on the bottle, e.g. "500 mg ER (generic for Glucophage XR)".
- **Quantity presets** come from the pack for that package (insulin: boxes of 5 pens, vials), plus a custom amount. Buy-now prices show **only for quantities a seller lists**: "Cost Plus lists 30 and 90 — see their site for 45". Never prorate.
- **Per-day math:**
  - Ask "How many a day? (from your label)" (optional; tablets/capsules only; never for pens, vials or inhalers).
  - Per-day and per-month math appear only after it's answered.
  - Otherwise show unit prices: "90 tablets: $X each · 30 tablets: $Y each".
- **Save star** with Save burst.

### 7.8 Results — Prices | Help paying
**Header:** product variant + quantity (tap to change), save, Share, "Card for the pharmacist".

**Prices tab**, in this order:
1. **Coverage banner** (from the screener):
   - Medicare: "Paying cash outside your Medicare drug plan may not count toward your yearly limit. Ask your plan first." Cash and coupon sections collapse under "If your plan won't pay for it".
   - Medi-Cal: "Medi-Cal may pay for this medicine. Ask the pharmacy to bill Medi-Cal first."
   - Job / Covered CA: "Also check your copay" + Copay Check ("Your copay: $X. Lowest listed online price here: $Y.").
2. **Price Ladder** (§5.6.3), shown only when there are ≥ 2 price rows.
3. **Order online or buy direct** (buyNow):
   - One card per option, with restrictions always visible.
   - Cost Plus: "Online pharmacy. Ships by mail. Not the price at local stores." plus the formula from the pack ("their cost + 15% + $5 pharmacy fee; shipping extra") with its source.
   - Ordering steps once verified.
   - Not in catalog → "Not listed on Cost Plus". Not loaded → "Price not loaded yet — check on Cost Plus".
4. **Price caps and program prices** (with who can use them).
5. **Different versions of this medicine** (other products in the group): their prices, no ribbon, "ask your pharmacist if your prescription allows them".
6. **Discount coupons — see the price on their website:**
   - "See prices on GoodRx" / "See prices on SingleCare".
   - "Prices change by pharmacy and ZIP code. GoodRx may show paid-membership prices first — you don't need to pay to see free coupon prices. Coupons usually can't be combined with insurance."
   - A one-time "You're leaving RxBridge…" notice.
7. **What pharmacies pay (for comparison):** collapsed by default.
   - "This is about what pharmacies pay for this medicine on average. You can't buy it at this price."
   - Math using the unrounded product (`$0.02792 × 30 = $0.8376 → $0.84`), as-of and effective dates.
   - Not loaded → "Not loaded yet. It updates weekly when the app is online."
8. **Generic outlook** (§8.4):
   - "A generic version may come out around {month year}. Prices could go down after that. This date is not a promise. Keep taking your medicine as your doctor told you."
   - Or "A generic version may come out in the next few years. We don't know exactly when."
   - Or nothing.
9. **Questions for your doctor or pharmacist:** "Is there a generic or lower-cost version?", "Can you write a 90-day prescription?", "Can you send it to the pharmacy I choose?"
10. **Where to fill it:**
    - Verified store records only, tagged by city, with hours only if published.
    - Call / Directions (opens the Maps app) / Store page.
    - "about X mi (straight line)" only from sourced coordinates after the person taps "Sort by distance".
    - No map view.
    - If none are verified: "We haven't confirmed store addresses yet", "Find pharmacies near you" (Maps search), plus county health-center pharmacies from the pack.

**Help paying tab:**
- **Group titles:** "Programs that may fit you" and "Other programs to check" (closed ones last: "Not taking new people right now"), plus a collapsed "Probably not a match" with reasons.
- **Program cards** show:
  - the limit in dollars for the household first (the % only in the math), or "Income limit not published — call to confirm";
  - the insurance rule and a fit badge (text + icon);
  - documents, phone, "Open application", "Help me make the call", "Track this application";
  - a source chip.
- **Empty states:**
  - "We didn't find a drug company program taking new people for this medicine." + "Get free help".
  - Generics: "Most generic medicines don't have a drug company help program."
- **Staleness:** programs older than their threshold show a sunflower banner.

### 7.9 Program detail, Call coach ("Help me make the call"), Application tracker
- **Program detail:** documents checklist with progress, where to send, the renewal term (only if published).
- **Call coach:**
  - Before-you-call checklist, then a giant Call button.
  - A script pre-filled from the person's answers, in their language with an English toggle.
  - The interpreter line appears only if the program publishes interpreter help.
  - Notes + reference number, stored on device only.
- **Tracker steps:** Not started → Getting papers ready → Sent → Waiting to hear back → They said yes / They said no.
- **"Renew by":** suggested only from a published term.
- **Reminders:** a local notification at 09:00 local time, and "Add to calendar", which opens the phone's own event editor (no calendar permission).
- **Reminder and calendar text:** "RxBridge reminder", with no medicine or program names unless the person turns names on.

### 7.10 Medicare panel
All year-scoped and sourced:
- **Part D cap:** the current year's cap, and next year's once published.
- **Extra Help:** limits as published for an individual and for a married couple (never scaled by household).
- **Medicare Savings Programs.**
- **Prescription Payment Plan:** "Lets you pay your drug costs in monthly parts. It does not lower the total."
- **$35 insulin cap.**
- **Negotiated prices:** "what Medicare plans pay, not your copay".
- **HICAP:** the statewide line and the local office.

"Check if you can get Extra Help" asks: married and living together? monthly income? Savings limits are shown as text.

### 7.11 My Plan
- **"Things you can do next"**: rules-engine steps, each with a clear destination. No time estimates unless sourced.
- **"Changes since your last visit"**: compared against `lastSeen`, then updated.
- **Saved medicines strip:** items whose ids vanished show "No longer in our list — search again". Never drop them silently.
- **Freshness row:** pack version and status.
- **Start over.**

### 7.12 My medicines
- **Saved list:** "Has a help program" badge; "Generic may come {year}" only under §8.4.
- **Budget:** "per fill" (known prices only, "+ N without a listed price", "plus shipping"). Per month only when the daily count is known.
- **Refill reminders:** "When will you need more? Check your label." The person picks the date. Neutral text.
- **App lock hint.**

### 7.13 Get help hub
- Coverage check (prefilled re-run), applications, Medicare, county programs.
- "Clinics that charge less if you earn less".
- "People who help for free" (Covered California certified enrollers, HICAP, county offices, 211 — verified only).
- Words explained; recent rule changes (notices).

### 7.14 Card for the pharmacist
- **Layout:** full-screen modal, high contrast. English on top, the person's language below; each block gets `accessibilityLanguage`.
- **Paging:** Previous / Next buttons with "Card 2 of 3". Swipe is optional, never the only way.
- **Cards:** "What is your cash price for {product} {strength} × {qty}?" · "Can you check the price with a discount coupon?" · "Is there a generic or lower-cost version?"
- **Screen:**
  - Keep-awake.
  - Brightness boost: save the current value on open; restore it on unmount and on background; re-raise it on active; app-level only; hidden on web.
- **Read aloud:** each block in its own language.

### 7.15 Share & print
- **Content:** a 1–2 page bilingual summary (the person's or client's language + English).
  - Buy-now and caps with restrictions; coupon links; the comparison price with math or "not loaded"; programs with phones.
  - "Not yet confirmed" marks; sources with dates; generated date.
  - A QR code for `share_base_url` if set (else the deep link), plus a plain-text summary.
- **Privacy:**
  - File named "RxBridge-summary.pdf".
  - "Include my household and income" is **off** by default.
  - Warning before sharing: "Anyone you send this to will see your medicine."
  - Delete the cached file after sharing; `lang` attributes on each block.
- **Also offer "Share as text".**

### 7.16 Navigator mode ("I'm helping someone else")
- **Storage:** client data lives in memory only.
- **"New client" and "Clear my data" wipe:**
  - screener answers, saved medicines, tracker, notes, recents;
  - cached PDFs and scheduled notifications;
  - calendar events the app created (track their ids where the OS returns them, and say what can't be removed);
  - deep-link state;
  - and stop speech.
- **Never schedule client reminders.**
- **Optional auto-wipe** after 15 minutes idle.
- **Languages:** the app language (navigator) is separate from the client language (handouts, card, scripts via `getFixedT(clientLang)`).

### 7.17 Settings / About / Sources
- **Display:** Language; Text size (buttons, not sliders) with preview; Theme; High contrast; Reduce motion; Haptics.
- **Read-aloud speed:** buttons, not a slider.
- **App lock:**
  - OS authentication with passcode fallback; no custom PIN.
  - If the phone has no screen lock, explain that and don't enable it.
  - Lock on cold start and after 60 s in the background.
  - Cover the app switcher snapshot when locked.
  - Hidden on web.
- **Modes:** Navigator mode; "Save mobile data" (skips feed refresh on cellular); "Show medicine names in reminders" (off by default).
- **Clear my data:** also cancels notifications.
- **Sources:** pack status, counts confirmed vs not, the not-shipped list, "How we checked".
- **About:**
  - The privacy text from §11.
  - Honesty rules.
  - Not affiliated: "RxBridge is not part of, or paid by, Medi-Cal, Covered California, Medicare, any county, GoodRx, SingleCare, Cost Plus Drugs, or any drug company. RxBridge does not give medical advice."
  - Font licenses.

### 7.18 Read aloud
- **Where:** one "Read this page" control in each screen header, plus a speaker on the pharmacist card and call script.
- **Screen readers:** hidden when one is running (avoid talking over VoiceOver/TalkBack).
- **Language:** each block is spoken in its own language.
- **Missing voice:** "Your phone has no voice for this language".

### 7.19 Label scan (P2, flag, dev builds only)
- Camera + on-device text recognition suggests the product; the image never leaves the device.
- Needs a dev-build config override (CAMERA is blocked in the default app.json).

---

## 8. Eligibility, matching and outlook engine (pure TypeScript, fully tested)

### 8.1 Income limits
- **FPL table:** `fpl.json` holds guideline years with an effective date. Each rule or program declares `fplYear`. Researched in 2026:
  - Medi-Cal MAGI uses the 2026 guidelines from 2026-01-01; the Aged & Disabled FPL program switches 2026-04-01.
  - Covered California uses the prior year's guidelines (2025 for plan year 2026).
- **Published charts win.** If a program publishes its own chart (e.g. the DHCS monthly limits), store `publishedLimits` with its source and use it instead of computing. A property test asserts computed values equal published charts.
- **Computing:**
  - Yearly limits are computed in exact cents, displayed floored to whole dollars.
  - Monthly = yearly / 12, floored.
  - `incomePctFplMax` is inclusive.

### 8.2 Profile and rules
- **Profile:**
  - `coverage: Set<'none'|'unsure'|'mediCal'|'medicare'|'job'|'coveredCa'|'county'|'other'>`
  - `age: 'under19'|'19to64'|'65plus'|null`, `county`, `householdSize`, `income: IncomeRange|null` (lo, hi]
  - Optional: married couple (Medicare panel), pregnancy (optional, Medi-Cal path only; never in notifications, PDFs or calendars).
- **Rules are data:** `{ all: Condition[] }` with insurance / coverage, income min/max % FPL, age, and county.
- **Rule tiers:** `mayQualify | worthChecking | notLikely`. `notLikely` is never rendered for public programs.
- **Household and income basis:** each program declares `householdDefinition` (`magi | extraHelpCouple | program`) and `incomeBasis` (`monthly | annual | program`). Non-MAGI programs can't reach a better tier than worthChecking.

### 8.3 Program matching
- **Insurance rules:** `uninsuredOnly | uninsuredOrUnderinsured | medicareAllowed | commercialOnly | any | unknown`, with a published fit table (unknown → maybe).
- **Groups:**
  - "may fit": the whole income range is under the cap, insurance fits, and the program is open.
  - "to check": everything else that's open.
  - "closed".
  - "Probably not a match": insurance doesn't fit, or the income range is entirely over the cap; collapsed, with reasons.

### 8.4 Generic outlook
- **Data:** `outlook.json` stores `orangeBookEarliest` (incl. pediatric exclusivity; ignore delisted patents) and an optional sourced `earliestMarketEntry: { date, basis: 'settlement' | 'courtRuling' | 'announcedLaunch' }`.
- **Effective date:** the later of the two.
- **When to show the 12-month message:** only when the basis is settlement, court ruling or announced launch. With patent or exclusivity dates only, say "We don't know when a generic will come out" or nothing. If sources conflict, show nothing and list it as unverified.
- **Windows:** [today, +12 mo) → the "around {month year}" message; [+12 mo, +36 mo] → "next few years".
- **Past date:** show nothing, emit a `OUTLOOK_EXPIRED:<id>` validator warning and a "Needs re-verification" entry.
- **Market status** comes from marketed NDCs (present in NADAC, or the NDC Directory marketing start), never from approval alone.
- **Required test fixture:** Eliquis on 2026-10-06 must give "next few years" (settlement date 2028-04-01), not "within 12 months", even though a key patent expires 2026-11-21.

### 8.5 Price math
- **Integers only:**
  - NADAC per-unit prices are stored as integer 1e-5 dollars (`perUnitE5`).
  - Cost Plus and other prices are integer cents.
  - Multiply as integers; round half-up to cents once, at display.
- **Never mix pricing units** (EA/ML/GM) and never price one variant with another's data.
- **Dates:**
  - `ISODate` is a calendar date. Never call `new Date('YYYY-MM-DD')`; parse it to `{y,m,d}` instead.
  - Diff with `Date.UTC`. "Today" is the device's local date.
  - `addMonths` clamps month ends.
  - Domain tests run under `TZ=America/Los_Angeles` and `TZ=Asia/Kolkata`.

---

## 9. Data architecture

### 9.1 Pack files (`data/packs/<regionId>/`)
| File | Holds |
|---|---|
| `manifest.json` | id, version, `status: draft\|release`, minAppVersion, generatedAt, SHA-256 per file (checked in CI), `renamedIds` |
| `region.json` | counties `{id, name, cities}`, languages, partner domains, feedback links |
| `fpl.json` | guideline years |
| `benefits.json` | coverage rules |
| `medications.json` | medicine → **products/variants** `{variantId, label (as printed), formulation ('ir'\|'er'\|'er-osmotic'\|'er-modified'\|…), relationship ('reference'\|'unbranded'\|'generic'\|'interchangeableBiosimilar'\|'biosimilar'\|'differentFormulation'), form, pricingUnit, unitsPerPackage, packageLabel, quantityPresets, ndcs[], costPlusProductPath?, goodRxUrl?, singleCareUrl?}`, aliases per language (incl. Traditional Chinese), category, kind |
| `programs.json` | PAPs, foundations, county programs: fplMax, fplYear, insuranceRule, householdDefinition, incomeBasis, closedToNew, documents, phone, interpreterAvailable, termMonths |
| `prices/costplus.json` | snapshot of Cost Plus **quotes** by product and quantity, via their public API only |
| `prices/direct.json` | manufacturer buyNow prices, price caps, program prices |
| `prices/nadac.json` | the weekly feed |
| `outlook.json` | §8.4 |
| `pharmacies.json`, `clinics.json`, `helpers.json` | city-tagged; lat/lng only if sourced |
| `notices.json`, `facts.json`, `glossary.json` | year-scoped where relevant |
| `unverified.json` | `{item, reason, lastTried}` |

**Pack rules:**
- **Localized text:** `{ en } & Partial<Record<Lang,string>>`. Missing languages show English tagged "(English)", and validate-packs warns.
- **Sources:** every fact record has `sources[]` + `verifiedAsOf`; validate-packs enforces this plus cross-references.
- **New region:** zero screen or domain changes. Registration is one generated line (`src/data/packs.generated.ts`).

### 9.2 Remote feed and updates
- **Pack updates:** packs change only with app releases (store or EAS Update).
- **The one remote feed:** NADAC, at `{feeds_base_url}/v1/{regionId}/nadac.json`. Host it on GitHub Pages or a `feeds` branch, not `raw.githubusercontent.com/main` (private repos return 404).
- **Feed metadata:** each feed carries `schemaVersion` + `minAppVersion`. The app ignores an unknown major version or a too-new minAppVersion.
- **Validation:** checksums are verified over the raw response text.

### 9.3 Price sources
- **NADAC (weekly GitHub Action)**
  - Find the current-year dataset in the data.medicaid.gov metastore (2026: `fbb83258-11c7-47f5-8b18-5f8e79f7e704`).
  - Query DKAN `/api/1/datastore/query/{id}/0`, ≤ 500 rows per page, paging with offset.
  - Match by each variant's `ndcs` (or exact description), newest `as_of_date`, then `effective_date`. When NDCs differ, show the min–max range.
  - Store `ndc, ndcDescription, perUnitE5, pricingUnit, effectiveDate, asOfDate, classification` (G, B, B-ANDA, B-BIO).
  - Support `--from-csv` for offline tests.
  - The job regenerates the manifest and VERIFICATION.md in the same commit (`contents: write`; open a PR if main is protected).
- **Cost Plus**
  - Use only their documented public pricing API (costplusdrugs.github.io/apidocs; params `ndc`, `quantity_units`; `requested_quote` includes the pharmacy fee, not shipping). Their Terms forbid scraping.
  - If the API is gone, the snapshot is manual, with evidence in `docs/evidence/costplus/YYYY-MM-DD/`.
- **Coupons:** links only, never fetched. Strip tracking parameters.

### 9.4 Research snapshot (gathered 2026-10-06; all **unconfirmed**)
These were seen only in web-search results, because the network policy blocked the official pages. They ship labeled "Not yet confirmed" in a `draft` pack. Re-check each on its official page before `release`.

| Topic | Value (as seen) | Where |
|---|---|---|
| HHS poverty guidelines 2026 | $15,960 / 21,640 / 27,320 / 33,000 / 38,680 / 44,360 / 50,040 / 55,720 (1–8), +$5,680 each; effective 2026-01-13 | federalregister.gov 91 FR 1797 |
| HHS poverty guidelines 2025 | $15,650 … $54,150 (1–8), +$5,500 each | federalregister.gov 90 FR 5917 |
| Medi-Cal FPL year | 2026 guidelines from 2026-01-01 (MAGI); 2026-04-01 (Aged & Disabled FPL program) | dhcs.ca.gov ACWDL 26-01 |
| Medi-Cal adults | ≤ 138% FPL; 2026 monthly ≈ $1,836 (1), $3,795 (4) | dhcs.ca.gov ACWDL 26-01 enclosures |
| Medi-Cal 2026 changes | Enrollment freeze for some adults 19+ (unsatisfactory immigration status; children and pregnant people exempt); asset test back for non-MAGI only ($130,000 + $65,000 each); GLP-1 weight-loss coverage ended | dhcs.ca.gov, medi-calrx.dhcs.ca.gov, ssa.santaclaracounty.gov |
| Covered California | Enhanced federal credits expired 2025-12-31 (400% cliff back); state help to 165% FPL (2026) and 200% (2027); open enrollment for 2027 runs 2026-11-01 → 2027-01-31; federal help limited by immigration status from 2027-01-01; prior-year FPL | coveredca.com, hbex.coveredca.com |
| Medicare | Part D cap $2,100 (2026); Extra Help ≈ $23,940 income / $18,090 resources (single); Payment Plan auto-renews in 2026; $35 insulin; Eliquis negotiated price $231 per 30 days (what plans pay); HICAP 1-800-434-0222 | cms.gov, ssa.gov, medicare.gov, aging.ca.gov |
| Santa Clara PCAP | Uninsured adults 19+, ≤ 650% FPL, county residents, includes prescriptions; 1-888-363-3394 | vhpn.santaclaracounty.gov |
| Region | Gilroy, Morgan Hill and Salinas are in CA-18 after Prop 50 → use counties | vote.santaclaracounty.gov |
| Eliquis | No US generic; settlements allow launch ≥ 2028-04-01 (patent 6,967,208 expires 2026-11-21; 9,326,945 in 2031). Maker's direct price $345 / 60 tabs (not for Medicare Part D); Cost Plus sells brand Eliquis since 2026-04-27; BMS PAF covers it (income cap unclear) | pfizer.com, eliquis.bmscustomerconnect.com, news.bms.com, bmspaf.org/rxassist.org |
| Insulin glargine | Interchangeable biosimilars glargine-yfgn / glargine-aglr. CalRx/Civica glargine-yfgn pens: suggested max $55 per box of 5 (pharmacies set the price; uneven availability). Sanofi Insulins Valyou and the Lilly Insulin Value Program: $35/month (eligibility differs). Lilly Cares and Sanofi Patient Connection: 400% FPL | accessdata.fda.gov, civicainsulin.org, gov.ca.gov, lantus.com, insulins.lilly.com, lillycares.com, sanofipatientconnection.com |
| Cost Plus | 15% markup + $5 pharmacy fee (since 2023-09); shipping extra; public API; prescribers e-prescribe to "Mark Cuban Cost Plus Drug Company" | costplusdrugs.com, costplusdrugs.github.io |
| NADAC | 2026 dataset `fbb83258-…`; DKAN API; units EA/ML/GM | data.medicaid.gov (catalog mirrors) |

**Still unknown (nothing ships about these):**
- pharmacy store records;
- NADAC values and Cost Plus quotes (filled by the weekly job);
- the Medi-Cal Rx phone and copays;
- H.R. 1 Medicaid start dates;
- SB 40 insulin copay cap details;
- California pharmacy-law details (cash-price disclosure, emergency supply, translated labels);
- Census language data;
- public-charge guidance;
- the 2027 Part D cap (secondary sources say $2,400);
- the Monterey HICAP office.

### 9.5 Staleness thresholds (per data type)
- NADAC: 21 days.
- Cost Plus snapshot: 60 days. The ribbon hides after 30.
- Programs, rules and places: 180 days.
- Year-scoped facts: their `effectiveTo`.

### 9.6 Verification workflow (`docs/VERIFYING.md`)
1. Open each source.
2. For non-URL facts, record `excerpt` + `locator`.
3. Set the method and dates.
4. Run `refresh:nadac`, `snapshot:costplus`, `pack:manifest` and `gen:verification`.
5. Once nothing is unconfirmed, set `status: release`; `check:packs -- --release` must pass.

**Link checker:** reports "blocked by network" separately from "bot-protected (403/429)" and from broken (404/410). It never deletes data.

---

## 10. Internationalization
- **Languages:** see the knob. RTL-ready (logical start/end); a pseudo-RTL pass.
- **Translation quality:**
  - Native-quality, grade 6–8, per-language term glossary.
  - Program and legal terms use the agency's published translation when one exists; otherwise keep the English name + a plain gloss ("Extra Help (Ayuda Adicional)").
  - Brand and program names stay in Latin script.
  - Machine-assisted strings are listed in `src/i18n/REVIEW.md`. Eligibility and legal strings need native-speaker review before a store release.
  - Run usability sessions with ≥ 5 target users per language.
- **Formatting:**
  - Money uses `Intl.NumberFormat(tag, {style:'currency', currency:'USD', currencyDisplay:'narrowSymbol'})` with tags en-US, es-US, zh-Hans-US, and **US digit grouping for Hindi** (hi-IN prints $1,23,456).
  - Dates use each language's own format, from a UTC-noon Date with `timeZone: 'UTC'`.
  - Table tests check the expected strings per language.
- **Intl:** at startup, feature-detect `Intl.PluralRules`, `RelativeTimeFormat` and `String.prototype.normalize('NFKC')`. Load `@formatjs` polyfills only if they're missing. A test deletes `Intl.PluralRules` and asserts plurals still render.
- **Checks:** key parity (plural-aware via `Intl.PluralRules(lang).resolvedOptions().pluralCategories`; zh needs only `other`), placeholder parity, no hard-coded JSX strings, pseudo-locale `en-XA` (+40%).
- **Links per language:** when an official page exists only in English, say so on the button: "Open Covered California (English)".

---

## 11. Robustness, privacy, security
- **Offline-first:** the app works fully with bundled data. Feeds use a 6 s timeout, retries and validation, and a bad feed never replaces good data.
- **Error boundaries:** one per route (Expo Router `export function ErrorBoundary`); never a white screen.
- **Deep links:**
  - Formats: `rxbridge://drug/{drugId}?v={variantId}&qty={1..999}` and `rxbridge://program/{programId}`.
  - Validated with Zod against the pack: unknown variant → default variant + notice; unknown drug → not-found with search.
  - Deep links never force onboarding and wait behind app lock.
- **Links out:** only to pack-allowlisted https hosts via expo-web-browser. `tel:`, `mailto:` and Maps URLs are built only from pack data.
- **Privacy:**
  - Copy: "We don't collect your answers. They're saved only in this app on this phone. Anyone who uses this phone could see them — you can lock the app in Settings."
  - **Backups:** `android.allowBackup: false`; exclude app storage from iCloud backup (dev build) or disclose it.
  - **Notifications:** Android visibility private; no medicine or program names by default.
  - **Calendar:** the system event editor, neutral titles.
  - **PDF:** see §7.15.
  - **Screens:** cover the app switcher when locked; block screen capture on sensitive screens where supported.
  - **Disclosures:** read-aloud may use the phone's voice service; "This opens your email app. We will see your email address."
- **No account, no backend, no analytics.**
- **Linters in CI:**
  - honesty-lint covers every language and pack text, with a per-key allowlist with justification (`scripts/honesty-allow.json`).
  - contrast-check, validate-packs, i18n-parity, and gen-verification `--check`.

## 12. Accessibility (WCAG 2.2 AA)
- **Contrast:** text 4.5:1; non-text 3:1 (bars use `solid`, inputs use `borderStrong`).
- **Targets and gestures:**
  - Targets ≥ 48dp, non-overlapping (2.5.8).
  - No gesture-only actions; buttons for everything (2.5.7 / 2.5.1).
- **Focus and help:**
  - Focus never hidden behind the tab bar, sticky footer, toasts or keyboard (2.4.11): content insets cover them, and toasts appear at the top.
  - Consistent "Get free help" in the same place on every screen (3.2.6).
- **Entry and authentication:**
  - No redundant entry (3.3.7).
  - OS authentication only (3.3.8).
- **Screen readers:**
  - Labels and roles on everything; headings marked.
  - Announce result counts, tab changes and price updates once.
  - Language of each part is set (3.1.2) on the pharmacist card, PDF and scripts.
  - The Price Ladder and Bridge have text equivalents.
- **Icon-only controls** are limited to Settings gear, Share, Save star, Close, Clear search and Remove recent. Each has a label.
- **Text:** 200% text without clipping (checked in Playwright via `scrollWidth > clientWidth`).
- **Manual testing:** `docs/A11Y_CHECKLIST.md` for VoiceOver, TalkBack, Switch Access and Full Keyboard Access.

## 13. Testing and quality (works in a no-simulator container)
- **Unit tests:** domain with property tests, TZ matrix and the Eliquis outlook fixture; Intl polyfill test; currency table tests; store migrations (v1 → v2 fixture).
- **Component tests:** every card state (normal, not listed, unconfirmed, stale, closed, error) in 4 languages, with mocked `fontScale: 2` (assert no fixed heights). Reanimated and worklets are mocked per their testing docs.
- **E2E in the container:** Playwright against `npx expo export --platform web`, served by `scripts/shoot.mjs` (SPA fallback).
  - Setup:
    - Chromium from `/opt/pw-browsers` (don't run `playwright install`).
    - Contexts 390×844 and 360×800; light and dark; `reducedMotion: 'reduce'` for deterministic states.
    - Seed zustand keys via `addInitScript`; wait for fonts and a `screen-ready` testID.
  - The same 7 flows as below.
- **Maestro:** flows are authored in `e2e/` (appId `host.exp.exponent`, `openLink: exp://…/--/…`) but run only on devices.
- **The 7 flows:**
  1. uninsured → result → search → results → help paying;
  2. insured + copay check;
  3. offline launch;
  4. language switch mid-flow keeps state;
  5. deep link;
  6. navigator wipe;
  7. save → My Plan.
- **Screenshot matrix:**
  - Every screen and state: 390×844, light, en.
  - Each screen once more: dark, 360×800 at 200% text, high contrast, and es / zh-Hans / hi.
- **Design gallery:** `/dev/gallery`, rendered when `EXPO_PUBLIC_GALLERY=1` at export time.
- **CI:** typecheck, lint, unit, i18n parity, honesty, contrast, packs, verification `--check`, web export, Playwright E2E.
- **On a device (not in the container):** cold start < 2 s on a mid-range Android. List anything untested on a device in the README.

## 14. Repo layout
```
src/app/                 routes: welcome, onboarding/*, (tabs)/{home,find,medicines,help}, drug/[id]/{index,results},
                         program/[id], call-coach/[id], applications, medicare, clinics, helpers, glossary,
                         settings/{index,sources,about}, counter-card, share, dev/gallery, +not-found
src/components/          feature components (onboarding/, results/, programs/, home/, settings/, help/), AppLockGate,
                         AnimatedSplash, DraftBanner
src/design/              tokens, theme, Text, primitives (Button, Card, Chip, Badge, Banner, ListRow, Segmented, Screen,
                         Sheet, SheetHost, SourceChip, GlossaryChip, ReadAloud, EmptyState, Illustration, FreshnessRing)
src/domain/              pure logic + tests
src/data/                schemas.ts, pack.ts, prices.ts, feeds.ts, localize.ts
src/hooks/               useProfile, usePrices, useLang
src/state/               settings, screener, medicines, applications, ui, session, storage
src/services/            haptics, speech, links, notifications, print (+ .web.ts variants)
src/config/flags.ts
src/i18n/                languages, resources, format, locales/<lang>/<namespace>.json, REVIEW.md
data/packs/<region>/     pack JSON (+ unverified.json)
scripts/                 validate-packs, pack-manifest, i18n-parity, honesty-lint (+ honesty-allow.json), contrast-check,
                         gen-verification, check-links, refresh-nadac, snapshot-costplus, shoot.mjs, lib/, __tests__/
.github/workflows/       ci.yml, data-weekly.yml, links-weekly.yml
locales-native/          iOS permission strings per language (app.json "locales")
e2e/                     Maestro flows (device) + web/ Playwright specs
docs/                    ARCHITECTURE.md, VERIFYING.md, A11Y_CHECKLIST.md, screens/, evidence/
README.md  VERIFICATION.md  AGENTS.md  app.json  eas.json
```

## 15. How to work
- **Research first, in parallel.** Every fact is recorded with method, URL and date, or `unconfirmed` with a note. Never from memory.
- **Several agents in parallel** need strict file ownership (one owner per route / component folder / i18n namespace). The lead owns `src/design`, `src/data`, `src/domain`, `src/state`, `src/services` and the shared hooks, and commits.
- **Verify every UI change through the web loop (§13)** and look at every screenshot. Say what wasn't tested on a device.
- **Phases:**
  1. Research the slice.
  2. Foundation.
  3. **Vertical slice:** onboarding (all branches), result, search, variant/strength/quantity, and Results (both tabs) for 3 drugs; en + es complete, zh-Hans + hi complete but in REVIEW.md. Signature moments: Bridge, People row, Price Ladder, Odometer, Show the math, Freshness Ring. Phase-4 buttons are hidden behind a `phase4` flag, not disabled.
     - **Checkpoint:** stop and show screenshots, schemas and open questions.
  4. The rest of §7.
  5. Scale the data.
  6. Polish, store prep (§18).
- **Each phase ends with a report:** what was built, screenshots, verified vs not, deviations and why, next steps.

## 16. Definition of done
- [ ] The native export (`npx expo export --platform ios --platform android`) and the web export (`--platform web`) succeed, and the web preview renders every screen without console errors. Expo Go was tested on real devices, or it is listed as untested.
- [ ] Zero placeholder text, hard-coded UI strings and `any`.
- [ ] Every fact shows a source chip; VERIFICATION.md is current.
- [ ] Pack status is `release` (or the README explains why it's still `draft`).
- [ ] CI is green, including Playwright E2E.
- [ ] The screenshot matrix (§13) has been reviewed.
- [ ] README covers purpose, run, checks, data refresh, adding a region/language/drug, honesty rules, assumptions, and what's untested on devices.

## 17. Never
- Never show a coupon dollar amount, an unconfirmed fact as confirmed, or a price attached to a local store location.
- Never say someone qualifies, will save, or that a generic will launch on a date. Never call any price "lowest" without "listed" and a date.
- Never rank a different product as the person's product, or imply cash beats their coverage.
- Never give medical advice (including shorter fills).
- Never collect immigration status, SSN or identity. Never send personal data off the device. Never name medicines in notifications, calendar events or file names by default.
- Never add an LLM chatbot or generated advice.
- Never use flags for languages, gesture-only actions or color-only status. Icon-only controls only from the §12 list.
- Never ship placeholder copy, or a button whose label doesn't name where it goes.
- Never hard-code FPL years, thresholds, fees or program rules in components.

## 18. Compliance and store policy (verify each before submitting)
- **Publisher:** publish under a legal entity (Apple guideline 5.1.1(ix) for health-adjacent apps — verify).
- **Store listing:** carries the not-affiliated text from §7.17. No third-party or drug logos. No brand drug names in the app name, subtitle or keywords. Run a trademark check on the app name.
- **Google Play:** complete the Health apps declaration and the Data safety form ("no data collected"). Follow the rules for apps that present government-program information (disclaimer + source links).
- **Apple:** privacy nutrition label ("Data Not Collected") and a privacy policy URL, even though nothing is collected.
- **Health-privacy law:** consider California CMIA (Civil Code 56.06) and the FTC Health Breach Notification Rule. On-device-only storage with no sharing keeps the exposure small. Document it.
- **Accessibility:** WCAG 2.2 AA conformance notes in `docs/A11Y_CHECKLIST.md`.
