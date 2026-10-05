# RxBridge — Master Build Prompt

> **How to use this file:** edit the **Knobs** block and anything marked `[TWEAK]`, delete what you don't want, then start a fresh Claude Code session on this repo and say: *"Build the app described in RXBRIDGE_BUILD_PROMPT.md."*

---

## 0. Knobs `[TWEAK]`

```yaml
app_name: RxBridge
tagline: "The lowest honest price for your medicine."
first_region: ca-south-bay            # CA-17 + CA-19: Santa Clara County, South Bay, Gilroy, Salinas area
launch_languages: [en, es, zh-Hans, hi]
next_languages: [vi, tl]              # the architecture must support these; they don't ship at launch
slice_drugs:                          # vertical slice: one of each kind (check each "why" during research)
  - metformin ER                      # cheap, common generic
  - apixaban (Eliquis)                # brand, generic not on market yet (check), manufacturer PAP
  - insulin glargine                  # biologic with biosimilars + insulin-specific programs
full_drug_list_size: 40               # only after the slice is approved
expo_go_compatible: true              # core features use no custom native modules
dev_build_only_features: [label_scan] # behind a feature flag, never required
medicare_branch: true
age_question: optional                # "Is anyone 65 or older?" — used only to show Medicare info
navigator_mode: true
read_aloud: true
app_lock: true
simple_view: false                    # P2: an "essentials only" layout for low digital literacy
mascot: false                         # the brand motif is the bridge, not a character
accent: indigo                        # see §5.1
pause_for_review_after_slice: true
web_preview: true                     # needed for screenshots in a cloud container
```

---

## 1. Your role and the bar

You are a senior mobile engineer, product designer and motion designer. Build **RxBridge** from an empty repo. It is a cross-platform Expo app (iOS and Android, plus a web preview) for people who struggle to afford prescriptions. It helps them find the lowest legitimate way to get their medicine and see whether they may qualify for public coverage or free-medicine programs.

**The bar:** it should feel like an Apple Design Award finalist that happens to be a public-good tool. It should be bright, warm, fluid and delightful. It must also stay calm, honest and very simple for a 70-year-old on a cracked Android phone with spotty data. Every screen should be good enough to proudly screenshot.

It is **not** a storefront, a marketing site or a coupon funnel. No ads, no affiliate links, no subscriptions, no accounts, and no AI chatbot inside the app.

Start fresh. There is no prior code to reuse.

### Failure modes to avoid (seen in earlier attempts)
- Flat, generic UI with no personality or motion.
- An ad-hoc screen state machine instead of real navigation, which breaks back gestures and deep links.
- Hard-coded UI strings and hard-coded income brackets.
- Household size capped at 5. FPL years that don't match the program using them.
- Income ranges labeled inconsistently. Buttons labeled with one program's name that open another program's site.
- Placeholder copy ("APP NAME", "Lorem", "TODO").
- Facts with no source or date.

---

## 2. The Honesty Contract (non-negotiable; overrides everything else)

1. **Never invent anything.** That covers prices, pharmacies, addresses, hours, phone numbers, URLs, programs, eligibility rules, patent or exclusivity dates, statistics and translations of legal terms. If you can't verify a fact, don't ship it. List it in `VERIFICATION.md` under "Unverified — not shipped".
2. **Every fact on screen carries a source chip** with the source name, link and verified-as-of date. Tapping the chip opens a sheet showing the verification method and a "Report a problem with this" button.
3. **Unknown is a first-class state.** Use "Not listed", "Call to confirm" and "Hours not published — see store locator". An honest empty state beats a filled-in guess.
4. **There are three price classes.** Never blend them. Each has its own visual treatment, copy and type in code:
   - **Buy now:** a real checkout price, such as a Cost Plus Drugs quote for the exact strength × quantity. Shown as a solid mint card.
   - **Coupon:** a link to a partner site. We never display its amount. Shown as a sky-outline card with a link-out icon and no dollar figure, ever. We never scrape coupon sites.
   - **Reference:** a benchmark nobody can buy at (CMS NADAC). Shown as a slate card with a diagonal hatch and the sentence *"What pharmacies pay wholesalers — you can't check out at this number."*
5. **Use hedged language** for anything predictive or about eligibility: "may qualify", "may face generic competition", "could drop". Never say "you qualify", "guaranteed", "will save" or "approved". The honesty linter (§11) enforces this.
6. **No medical advice.** Never suggest switching drugs, changing a dose, splitting pills or stopping a medicine. The app may only suggest questions to ask a doctor or pharmacist.
7. **Show the math** wherever a number is computed, such as unit price × quantity or % FPL → dollars.
8. **Ask only for what's needed.** Never ask about immigration status, SSN or identity. Answers stay on the phone.

Encode the contract in types. UI components that render facts accept only `Sourced<T>`:

```ts
type VerificationMethod = 'http-200' | 'browser-confirmed' | 'official-data-file' | 'official-pdf' | 'phone-confirmed';
type SourceRef = { name: string; url: string; method: VerificationMethod; checkedOn: ISODate; edition?: string };
type Sourced<T> = { value: T; sources: [SourceRef, ...SourceRef[]]; verifiedAsOf: ISODate };
type PriceClass = 'buyNow' | 'coupon' | 'reference';
```

---

## 3. People we're designing for

- **Rosa, 62, Salinas.** Reads Spanish first. Uninsured. Takes metformin and lisinopril. Has an Android phone with limited data. Reads English slowly and is slow to trust an app.
- **Wei, 74, San José.** Reads Mandarin first. On Medicare. A daughter set up the phone, but Wei uses it alone. Needs large text and sometimes uses VoiceOver.
- **Anjali, 38, Gilroy.** Caregiver for a parent. Switches between Hindi and English. Needs to share a summary with a sibling.
- **Marcus, community health worker.** Sees 12–15 clients a day in several languages. Needs speed, needs no data left behind between clients, and needs a printable bilingual handout.

**Design principles**
1. **One job per screen.** Each screen asks one question or makes one decision, with one primary button.
2. **Never a dead end.** Every empty or error state offers a next step.
3. **Show your work.** Math and sources are always one tap away.
4. **Calm first, delight second.** Animation explains a change. It never delays the user or decorates for its own sake.
5. **Same answer in every language.** Switching language mid-flow changes the words, never the state.
6. **Built for the worst phone.** Assume a small screen, 200% text, no data and TalkBack on.

---

## 4. Platform and stack

Use the **latest stable Expo SDK at build time** (check it; don't assume) with the New Architecture. Use strict TypeScript: no `any` in app code, with `noUncheckedIndexedAccess` on.

| Concern | Choice | Notes |
|---|---|---|
| Navigation | Expo Router, typed routes | Real stacks, OS back gestures, Android hardware back, deep links `rxbridge://drug/{id}?strength=&qty=` |
| Animation | react-native-reanimated (version matched to the SDK) + react-native-gesture-handler | Layout animations, worklets on the UI thread, `useReducedMotion` |
| Custom drawing | @shopify/react-native-skia | Graph-paper background, Bridge progress, Price Ladder, Freshness Ring. Set up CanvasKit for the web preview |
| Lists | @shopify/flash-list | Every long list |
| Session state | Zustand + persist through a storage adapter | Default adapter is Expo-Go-safe (expo-sqlite kv-store or AsyncStorage). MMKV adapter for dev builds only |
| Remote data | TanStack Query + persisted cache | NADAC feed and data-pack updates |
| Validation | Zod | All packs, remote JSON and deep-link params |
| i18n | i18next + react-i18next, ICU plurals, typed keys | expo-localization for defaults |
| Search | Custom multilingual fuzzy matcher (or Fuse.js) | See §7.6 |
| Icons | lucide-react-native (react-native-svg) | Line icons, always paired with text |
| Fonts | @expo-google-fonts: Fredoka + Atkinson Hyperlegible Next (fall back to Atkinson Hyperlegible) | System fonts for CJK and Devanagari (§5.3) |
| Device | expo-haptics, expo-speech, expo-print, expo-sharing, expo-location, expo-notifications (local only), expo-calendar, expo-web-browser, expo-local-authentication, expo-keep-awake, expo-brightness, expo-network | Confirm each works in Expo Go on the chosen SDK |
| QR | react-native-qrcode-svg (in app), `qrcode` (SVG string for PDFs) | |
| Testing | Jest + React Native Testing Library, fast-check (property tests), Maestro (E2E) | |
| Quality | ESLint flat config + eslint-plugin-react-native-a11y, Prettier, `tsc --noEmit` | |
| Builds | EAS: development / preview / production profiles | Bundle IDs, icons, splash, permission strings in every launch language |

Any feature that needs a custom native module (for example, on-device OCR) goes behind a feature flag and ships only in dev/EAS builds. It must never be required for a core flow.

---

## 5. Design language — "Daybreak"

**The concept is sunlight through a pharmacy window:** bright, optimistic and clean, but every color has to earn its place. Surfaces stay big and calm. Saturated color appears only in small doses: chips, icons, progress, illustrations and the one primary button. **Every bright color carries a meaning.**

### 5.1 Color tokens
These are starting values. The contrast script in CI has the final say; adjust values until it passes.

**Light theme**

| Token | Value | Use |
|---|---|---|
| `bg` | `#EEF6FF` | Sky wash behind everything |
| `gridMinor` / `gridMajor` | `#3B82F6` @ 6% / 11% | Graph paper: 24dp minor, 96dp major |
| `surface` | `#FFFFFF` | Cards |
| `surfaceSunken` | `#F5F9FE` | Inputs, wells |
| `border` | `#D5E1EF` | 1dp card borders |
| `text` | `#0F172A` | Body and headings |
| `textMuted` | `#475569` | Secondary text |
| `accent` | `#4F46E5` | Primary button, links, selection |
| `accentSoft` | `#E0E7FF` | Selected chip background |
| `onAccent` | `#FFFFFF` | Text on accent |
| `focus` | 3dp ring | Must clear 3:1 against both `bg` and `surface` |

**Signal palette.** Each signal has a `fill` (shapes and illustration only), a `tint` (backgrounds) and an `ink` (text and icons; must pass AA on white and on its own tint).

| Signal | Meaning | fill | tint | ink |
|---|---|---|---|---|
| mint | Buy now, success, savings | `#20C997` | `#E6FCF5` | `#087F5B` |
| sky | Coupons, info | `#339AF0` | `#E7F5FF` | `#1864AB` |
| lilac | Programs, coverage | `#9775FA` | `#F3F0FF` | `#6741D9` |
| tangerine | Generic outlook | `#FF922B` | `#FFF4E6` | `#C2410C` |
| sunflower | Stale data, caution | `#FCC419` | `#FFF9DB` | `#8A5A00` |
| coral | Closed to new patients, errors | `#FF6B6B` | `#FFF5F5` | `#C92A2A` |
| slate | Reference-only prices | `#94A3B8` | `#F1F5F9` | `#334155` |

**Dark theme:** a deep navy background (about `#0B1020`) with a fainter grid, surfaces around `#131A2E` and lighter inks. Keep the same hierarchy and the same meanings. Derive and validate the values; don't eyeball them.

**High-contrast mode:** no grid, no tints behind text, 2dp borders, text and ink at 7:1 or better, and a pattern plus a label on every status.

**Color is never the only signal.** Every status has a text label and an icon. Reference prices also get the hatch pattern.

### 5.2 Shape, depth, spacing
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48. Radius: 12 for inputs and chips, 20 for cards, 28 for sheets and hero cards, pill for buttons and chips.
- Cards are white with a 1dp border and a soft accent-tinted shadow (y 4, blur 16, ~6% opacity). Hero cards may add a subtle top-edge gradient in their signal tint.
- The primary button is 56dp tall, full width on phones, accent fill, with a Fredoka label. Every tap target is at least 48×48dp.
- **Card anatomy is always the same:** label → big value → package (e.g. "20 mg × 30 tablets") → note → source chip.

### 5.3 Typography
- Headings and display text use **Fredoka 600**. Body and UI text use **Atkinson Hyperlegible Next**. Prices use **tabular numerals** (`fontVariant: ['tabular-nums']`); if the body font lacks `tnum`, use a numeric face that has it.
- Fredoka has no CJK or Devanagari glyphs, so use per-locale font stacks. zh-Hans and hi use system fonts for headings and body. Don't bundle multi-megabyte Noto files unless glyphs actually break; test on Android. Hindi body text needs a line-height of at least 1.6 for matras.
- The type scale follows Dynamic Type / `fontScale` up to 200%. Nothing that contains text gets a fixed height. Layouts reflow, for example two columns become one at large scales.

### 5.4 Illustration and brand
- **App icon:** a bridge arc spanning a capsule pill, accent on sky. Include an Android adaptive icon and a monochrome themed-icon variant.
- **Spot illustrations:** a small set of flat, geometric SVGs in the signal colors, with no photos of people: pill bottle, bridge, pharmacy storefront, phone call, documents folder, map pin, calendar and magnifier. Every empty state gets one.
- **Graph-paper background:** drawn once with Skia (static and cheap), disabled in high contrast.

### 5.5 Motion system
- **Tokens:** `fast 120ms`, `base 200ms`, `slow 320ms`, `celebrate 600ms` (the maximum). One standard easing, `cubic-bezier(.2, 0, 0, 1)`. One spring (damping ~18, stiffness ~180) for presses and sheets.
- **Rules:** motion shows where things came from. Nothing loops except a loading shimmer. No animation blocks input. Screen transitions take 300ms or less. All animation runs on the UI thread.
- **Reduce Motion** follows the system setting by default and can be overridden in Settings. With it on, slides, scales and flips become crossfades of 150ms or less. The Bridge renders in its final state, count-ups jump to the final value, and there are no sparkles.
- **Press feedback:** every tappable element scales to 0.97 with a haptic tick (respecting the haptics setting).

### 5.6 Signature moments (what makes it unforgettable)
1. **The Bridge.** Across the top of the onboarding screener, a Skia bridge builds plank by plank as each question is answered: language → coverage → household → income → result. On the result screen the arc completes and a small glowing dot walks across it. It doubles as the accessible progress bar ("Step 3 of 5").
2. **People row.** On the household screen, the stepper adds and removes small person glyphs that pop in with a spring, so the count is visible. At "8 or more" the user can optionally type an exact number.
3. **Price Ladder.** At the top of Results, one Skia chart puts every option on the same scale:
   - Buy-now bars grow in sequence.
   - The reference bar is hatched slate.
   - Coupon rows get **no bar**, because we don't know the amount. They get a dashed outline and "Check price on GoodRx / SingleCare".
   - The lowest Buy-now option gets a mint "Lowest you can pay today" ribbon with a brief sparkle.
   - Screen readers get the whole chart as a list.
4. **Odometer prices.** Dollar amounts roll into place in tabular digits when they first appear and whenever strength or quantity changes.
5. **Show-the-math flip.** Tapping any price card flips it to show the arithmetic and the formula. Examples: NADAC `$0.02792 × 30 = $0.84`; Cost Plus = acquisition cost + markup + pharmacy fee, shipping extra, with the fee values taken from data. With Reduce Motion on, this becomes a crossfade.
6. **Freshness Ring.** A small ring next to each date that drains as data ages toward 6 months, shifting mint → sunflower → coral. It always has text, such as "Checked 12 days ago".
7. **Save burst.** Saving a medicine fills the star with a tiny radial burst and a success haptic.
8. **Animated splash.** The icon's bridge arc draws in, then the home screen rises beneath it. The whole thing takes 700ms or less and is skipped with Reduce Motion.
9. **Shared transition** from a search result row into the Results header. Use Reanimated shared transitions only if they're stable on the chosen SDK; otherwise use a fade-through.

---

## 6. Information architecture

```
First launch (stack):
  Welcome + Language → Coverage → [Coverage type] → [Insurance checklist | Household → Income] → Coverage result
  ("Just search for a medicine" skips straight to the tabs)

Tabs:
  1. My Plan        personalized next steps, saved medicines, reminders, data freshness, changes since last visit
  2. Find medicine  search → strength & quantity → Results (Prices | Help paying)
  3. My medicines   saved list, monthly budget, refill reminders
  4. Get help       coverage check, programs, applications tracker, call coach, clinics, free human help, glossary

Header gear → Settings.
Sheets: Source, Glossary term, Share, Pharmacy Counter Card.
```

Persist progress so a restart resumes exactly where the user was. "Start over" lives in My Plan and in Settings.

---

## 7. Screens
For each screen, the spec covers its job, content, states, motion and accessibility.

### 7.1 Welcome + Language
- Four large language buttons, each labeled in its own script, with no flags: English · Español · 中文（简体） · हिन्दी. The region pack can add more.
- A one-line purpose statement in the selected language, plus "Your answers stay on this phone." with a lock icon.
- Two buttons: **Get started** (primary) and **Just search for a medicine** (secondary).
- Changing the language re-renders instantly with a crossfade. The choice is remembered and can be changed anytime.

### 7.2 Coverage
- "Do you have health insurance right now?" **Yes / No / Not sure.**
- **Yes** → "What kind?" with four options: Job or Covered California · Medi-Cal · Medicare · Other / don't know.
  - **Job / Covered CA / Other** → **Insurance checklist** with items to check off: member card and services number, formulary tier, deductible, copay, preferred or mail-order pharmacy. Then a **Copay Check**: the user enters their copay, and Results compares it with the Buy-now price. The caveat uses verified wording along the lines of "Cash may be lower, but cash payments may not count toward your deductible. Ask your plan."
  - **Medi-Cal** → a plain explanation of how Medi-Cal prescriptions work (Medi-Cal Rx), with verified wording and a link. Then search.
  - **Medicare** → Medicare panel (§7.10). Then search.
- **No / Not sure** → Household.
- `[TWEAK]` Optional question: "Is anyone in your household 65 or older?" It is used only to show Medicare information and can be skipped.

### 7.3 Household
- A big stepper with the People row (1 through 8+).
- A "Who counts in my household?" glossary chip with a verified explanation, because the household rules (MAGI) aren't intuitive.

### 7.4 Income
- A **Monthly / Yearly** toggle, defaulting to yearly; many people think in monthly income. The other unit appears in muted text underneath.
- Bracket cards, 3–4 visible at a time:
  - Computed at runtime from `fpl.json` for this household size and the thresholds that active rules and programs actually use.
  - Labeled in exactly one format everywhere: "Under $X a year" · "$X to $Y a year" · "Over $Y a year", localized with Intl.
  - Shown with exact dollar edges. Never round in a way that changes meaning.
- **"Type my exact income instead"** (it stays on the device). If the exact income is within about 5% of a threshold, show: "You're close to the limit. Apply anyway — the program decides."
- **"Prefer not to say"** skips eligibility; everything else keeps working.
- A "What counts as income?" glossary chip.

### 7.5 Coverage result
- The Bridge completes. Show one to three plain-language cards with a lilac tint:
  - **"You may be eligible for Medi-Cal"**, with buttons labeled exactly "Apply on BenefitsCal" and "Learn about Medi-Cal (DHCS)".
  - **"You may qualify for help paying for Covered California"**, with a button labeled "Open Covered California".
  - **"Standard coverage options"** when neither applies.
- Each card shows the threshold in dollars for this household, plus a source chip. A button's label always names where it goes.
- "This is an estimate, not a decision."
- A data-driven **"Rules changed recently"** notice when `notices.json` has one for this region, with its source and date.
- "What happens next" mini-steps: how long applying takes and what to have ready (verified items only).
- Primary button: **Compare prices for my medicine.**

### 7.6 Find medicine
- A large, autofocused search field with a clear button, recent searches (each deletable) and a "Common prescriptions" grid with category color chips.
- **Matching works across languages and scripts.** It covers brand names, generic names, every per-language alias in the pack, and transliterations. For example, "metformina", "二甲双胍", "मेटफॉर्मिन" and the typo "metfromin" all find metformin. Normalize accents, case and character width. Rank exact matches first, then prefix matches, then fuzzy matches.
- **Each result row shows:** the brand (bold) · generic name, a summary of forms and strengths, a category chip, and a "Generic available" / "Biosimilar available" / "Brand only" badge.
- **Empty state:** an illustration, "No match — try the generic name (it's on your pill bottle label)", and "Ask us to add this medicine" (a mailto or form link from the pack).
- The screen reader announces the result count.

### 7.7 Strength & quantity
- Strength chips (from the pack), form, and quantity presets of 30 / 60 / 90 plus a custom amount, with a live "about N days" helper.
- A **cost-per-day preview** when a Buy-now price exists for the selection, plus a 30-vs-90 comparison ("90-day supply: $X a day vs $Y"). Buy-now prices only.
- A save star with the Save burst. Primary button: **See prices.**

### 7.8 Results — a header and two tabs: **Prices** | **Help paying**
**Header:** drug name and strength × quantity (tap to edit inline; everything below updates with the odometer), save star, share, and a **Counter card** button.

**Prices tab, in this order:**
1. **Context banner** if the user is insured: "Also check your copay", plus the Copay Check result if they entered a copay.
2. **Price Ladder** (§5.6.3) as the at-a-glance summary.
3. **Buy now — Cost Plus Drugs.**
   - Quote for the exact strength × quantity from the dated snapshot, with a formula note (fee amounts from data), "shipping extra", the snapshot date, and an "Open on Cost Plus" button.
   - If the drug isn't in the catalog: "Not listed on Cost Plus". Never guess.
   - If only a biosimilar or an alternative is listed, say exactly that.
4. **Coupons — amount shown on partner site.**
   - Side-by-side "Open GoodRx coupon" and "Compare on SingleCare" buttons, each deep-linking to that drug's verified page.
   - Note that amounts vary by pharmacy and ZIP code. GoodRx may show paid-membership prices at the top, so compare its free coupon price; SingleCare shows free coupon prices.
   - No dollar figures, ever.
5. **Fair-price reference — CMS NADAC.**
   - Per-unit price × package size with the math shown, the as-of and effective dates, the hatch pattern, and the "can't check out at this number" sentence.
   - `[TWEAK]` An optional trend sparkline from the weekly history (reference only).
6. **Generic outlook (tangerine).** Shown only for brand drugs with no generic or biosimilar on the market. Drugs that already have alternatives get a single info line instead.
   - Earliest relevant verified expiry within 12 months: "May face generic competition within about 12 months — prices could drop. You could ask about shorter fills."
   - Earliest expiry in 1–3 years: "Generic competition is possible in the coming years."
   - Otherwise: show nothing.
   - If the date has already passed, don't show the 12-month message; flag the record for re-verification instead.
   - Always say "not a promised launch date" and show the source edition. Where relevant, add a one-line explanation of generic vs. biosimilar.
7. **Ask your doctor or pharmacist.** Questions only: "Is there a generic?", "Can you write a 90-day prescription?", "Can you send it to the pharmacy I choose?"
8. **Nearby pharmacies.**
   - Verified addresses from official chain locators, a district tag, and no prices attached to stores.
   - Hours only if they're published; otherwise "See store locator".
   - Buttons: Call · Directions · Store page.
   - Sorted by distance if location is granted; ask only on this screen, with a plain reason. Otherwise sorted by district.
   - Optional map toggle.

**Help paying tab:**
- **Matching inputs:** coverage status, household size, income bracket (or exact income), and each program's published FPL cap and insurance rule.
- **Two groups:** "Programs you likely qualify for" and "Other programs worth checking". A program counts as "likely" only if all three are true:
  - the user's entire bracket is under the cap;
  - the insurance rule fits;
  - the program is open to new patients.
- **Each program card shows:**
  - name, sponsor, and what it covers (only drugs in this app);
  - the income cap as % FPL **and** in dollars for this household;
  - the insurance rule, with a coral "Closed to new patients" badge where it applies;
  - a documents checklist, plus where and how to send the application;
  - tap-to-call, the application link and the verified-as-of date;
  - a **Call coach** button.
- **Honest empty states:** "No verified manufacturer program enrolls new patients for this medicine." / "Generics often have no brand assistance program — the Buy-now price may be your best option."
- A sunflower **staleness banner** when listings are more than 6 months old.
- **Track this application** → Applications tracker.

### 7.9 Program detail, Applications tracker, Call coach
- **Applications tracker.** Each program moves through: Not started → Gathering documents → Sent → Waiting → Approved / Denied → Renew by {date}.
  - The documents checklist persists.
  - An optional local reminder to renew (by notification or calendar event) uses the program's verified term length.
- **Call coach.**
  - A before-you-call checklist and a big **Call** button.
  - A call script pre-filled with the user's situation (household, coverage, medicine, strength), in their language with an English toggle.
  - "You can ask for an interpreter" appears only when the program data says so.
  - Notes and reference-number fields, saved locally.
  - Read aloud.

### 7.10 Medicare panel (if `medicare_branch`)
Data-driven, verified and in plain language:
- the Part D out-of-pocket cap for the current year;
- Extra Help (the Low-Income Subsidy), with its limits for this household;
- the Medicare Prescription Payment Plan;
- free local counseling (California HICAP).

Each item gets a source chip. No number appears without verification.

### 7.11 My Plan (home tab)
- **"Your next best steps."** A pure, tested rules engine generates these from the user's answers and saved medicines, and every step links to where it gets done. An example of the *shape* (not real data):
  1. Apply for Medi-Cal (about N minutes online).
  2. Meanwhile, {drug strength × qty} is {Buy-now price} on Cost Plus.
  3. Call {program} about {brand drug}.
- **Changes since your last visit**, for example "The Cost Plus snapshot for metformin ER changed from $X to $Y (snapshot date)". Buy-now prices only.
- A saved-medicines strip with the best known Buy-now price per fill.
- Upcoming reminders (refills and renewals).
- A data-freshness row with the Freshness Ring and the pack version.
- **Start over.**

### 7.12 My medicines
- The saved list (FlashList). Each entry shows strength × quantity, the best known Buy-now price, cost per month, and badges: **Generic watch** and **Program available**.
- **Monthly budget:** the sum of verified Buy-now prices only, e.g. "$23.40 a month for 3 medicines + 1 without a listed price". Never estimate the unknown.
- Refill reminders (local notifications).
- Optional **app lock** (Face ID, fingerprint or device PIN), because a medicine list is sensitive.

### 7.13 Get help hub
- Coverage check (re-runs the screener).
- Programs for my medicines.
- Applications tracker.
- Sliding-fee community clinics in the region, verified through the HRSA health-center finder.
- Glossary.
- **"People who help for free":** Covered California certified enrollers, county social services, HICAP and 211 — only the ones that are verified.

### 7.14 Pharmacy Counter Card
- A full-screen, high-contrast card to show at the pharmacy counter: English on top, the user's language below.
- Swipeable cards:
  - "What is your cash price for {drug} {strength} × {qty}?"
  - "Can you check the price with a discount coupon?"
  - "Is there a generic?"
- Keeps the screen awake and optionally raises app brightness while open, restoring it on close.
- Read-aloud button.

### 7.15 Share & print
- A one-page bilingual summary, with the user's language and English side by side. It includes:
  - the medicine and strength × quantity;
  - the Buy-now price and coupon links;
  - the NADAC reference with its math;
  - programs with phone numbers, and pharmacies;
  - sources and dates;
  - a QR code that deep-links to the same drug, strength and quantity.
- Generated as HTML → PDF with expo-print and shared through the share sheet. It must also look right printed in black and white.

### 7.16 Navigator mode
- Turned on in Settings ("I'm helping someone else").
- It separates the **app language** (the navigator's) from the **client language**, which is used for handouts, the counter card and the call script.
- Nothing persists between clients. A big **New client** button wipes the session after a confirmation.
- A quick-jump layout, with the handout as the main output.

### 7.17 Settings / About
- **Language & display:** language; text size with a live preview; theme (system / light / dark); high contrast; reduce motion (follow system / on / off); haptics; read-aloud speed.
- **Modes & privacy:** app lock; navigator mode; low-data mode (skips remote feeds on metered connections); notifications; clear my data (asks to confirm, then shows a confirmation toast).
- **Data & trust:** data sources and dates; how we verify; report a problem (mailto or form with the record ID and pack version, and no personal data).
- **About:** app version and data pack version; licenses.

### 7.18 Read aloud (everywhere)
- A speaker button on every card heading and on each screen's main text, using expo-speech in the current language.
- It picks a matching device voice. If none is installed, it says "No voice installed for this language" with a hint about OS settings.
- Speech stops on navigation.

### 7.19 Label scan (P2; feature flag; dev builds only)
- The user points the camera at the pill-bottle label; on-device text recognition suggests the drug and strength.
- The image never leaves the device. The feature is never required, and manual search is always available.

---

## 8. Eligibility and matching engine (pure TypeScript, fully unit-tested)

- **FPL data.** `fpl.json` holds several guideline years. Every rule and program declares **which FPL year it uses**; programs don't all use the same year, so verify each one.
  - Threshold = guideline for the household size × percent / 100. Derive guidelines for large households from the published per-additional-person amount.
  - Verify the formula against the source.
- **Eligibility rules are data.** `benefits.json` holds them; nothing is hard-coded in components:
  ```json
  {
    "id": "medi-cal-adult",
    "when": { "all": [ { "insurance": ["none", "unsure"] }, { "incomePctFplMax": 138 } ] },
    "fplYear": 0,
    "links": [],
    "sources": [],
    "verifiedAsOf": ""
  }
  ```
  (Shape only. Every value comes from research.)
- **Outputs are tiers:** `mayQualify` / `worthChecking` / `notLikely`. There is never a boolean called `eligible`.
- **PAP ranking:** likely (whole bracket under the cap + insurance fits + open to new patients) → worth checking (partial overlap, unpublished cap or unclear insurance rule) → closed to new patients (shown last, with a badge).
- **More pure modules:** outlook tiers, staleness (6 months), feed resolution (newer wins, with a fallback chain), price math (unit × quantity, rounded to cents only at display time) and My Plan steps.
- **Property tests** (fast-check) cover bracket edges, household sizes 1–20, and date boundaries such as leap years, expired dates and timezones.

---

## 9. Data architecture

### 9.1 Packs
Packs live in `data/packs/{regionId}/`. They are versioned JSON, validated with Zod at build time and again at load time. The Zod schemas are also exported to JSON Schema for contributors.

**Core files**
- **`manifest.json`:** pack id, version, minAppVersion, generatedAt, and file checksums (SHA-256).
- **`region.json`:** id, name, districts, languages, benefit programs with links, and the partner-link domain allowlist.
- **`fpl.json`:** contiguous-US guidelines by year and household size, plus the per-additional-person amount.
- **`benefits.json`:** eligibility rules (§8).

**Medicines and places**
- **`medications.json`**, per drug:
  - id, brand, generic, category;
  - aliases per language, including transliterations;
  - forms, strengths and typical quantities;
  - partner links: `costPlusUrl` per strength (or null), `goodRxUrl`, `singleCareUrl` (or null);
  - program ids, `hasManufacturerPap`, and `marketStatus` (`brandOnly | genericAvailable | biosimilarAvailable`).
- **`pharmacies.json`:** name, chain, address, lat/lng, phone, district, hours (structured, or `{ "seeLocator": true }`), locator URL, `addressVerified` and `verifiedAsOf`.

**Programs and outlook**
- **`programs.json`**, per program:
  - kind (`manufacturerPap | nonprofit | state | county`), sponsor, and covered medication ids;
  - income: `fplMax` (null when unpublished) and `fplYear`;
  - rules: `insuranceRule` enum, `closedToNew`, `termMonths` and cutoff text;
  - contact: `applicationUrl`, phone and `interpreterAvailable` (nullable);
  - applying: `documents[]`, `sendWhere` and a call-script template id;
  - `sources[]` and `verifiedAsOf`.
- **`outlook.json`**, per drug: kind (`prediction | alreadyHasAlternative`), earliest relevant expiry, a label (patent or exclusivity number), the source (Orange Book edition or Purple Book BLA) and `verifiedAsOf`.

**Supporting files:** `clinics.json`, `helpers.json` (free human help), `notices.json` (rule changes), `glossary.json`, `scripts.json` (call and counter scripts with ICU placeholders), `prices/costplus-snapshot.json` and `prices/nadac.json`.

**Pack rules**
- Every record has `sources` and `verifiedAsOf`. CI fails if either is missing or if `verifiedAsOf` is in the future.
- A new region is a new pack folder plus locale strings for its program names, with zero code changes. Prove it with a small second **test-only** fixture pack that is clearly fake, never shipped, and loaded by the test suite.

### 9.2 Prices
- **NADAC**
  - A scheduled GitHub Action (weekly) queries the current CMS NADAC dataset on data.medicaid.gov. Find the current dataset ID; it changes by year.
  - It keeps only this app's drugs, writes `nadac.json` with as-of and effective dates, validates the file and commits it.
  - On launch, the app fetches the hosted JSON (6s timeout, retry with backoff) and validates it. It uses the file only if it's newer than the cache or the bundled copy.
  - On any failure the app silently falls back: cache, then bundled snapshot. The as-of date is always shown.
- **Cost Plus**
  - A script builds a dated snapshot per strength and quantity from Cost Plus's public pricing source.
  - First confirm that such a source exists and that its terms allow this. If not, document a manual snapshot method.
  - Fee amounts are stored as data, with sources.
- **Coupons:** links only. Never scrape. Strip tracking and affiliate parameters from partner URLs.

### 9.3 Verification workflow (document it in `docs/VERIFYING.md`)
- **Methods:** `http-200`, `browser-confirmed` (for bot-protected pages), `official-data-file`, `official-pdf`, `phone-confirmed`.
- **URLs:** a link-checker script (weekly Action) reports broken links as a GitHub issue; it never auto-deletes data.
- **Programs:** check the official application page, then cross-check with RxAssist and NeedyMeds.
- **Patents and exclusivity:** use the FDA Orange Book data files (products, patent, exclusivity) or the Purple Book. Ignore delisted patents and record the edition.
- **Report:** `scripts/gen-verification.ts` generates `VERIFICATION.md` from the packs. It lists every fact with its source, method and date, plus an "Unverified — not shipped" section.

### 9.4 Research leads `[TWEAK]`
**Verify each of these before using it. None of them is a fact yet.** Use parallel research subagents. Each one returns facts with a URL, method and date, or "could not verify".

**Coverage and benefits**
- Which HHS poverty-guideline year each program uses for the current benefit or plan year. ACA subsidies and Medi-Cal may differ.
- Recent Medi-Cal rule changes affecting new enrollment, asset tests and phased-in federal requirements. Surface them through `notices.json` if verified.
- Covered California financial help for the current plan year: the status of enhanced federal premium tax credits, state subsidies and open-enrollment dates.
- Medicare: the Part D out-of-pocket cap for the current year, Extra Help limits, the Medicare Prescription Payment Plan and California HICAP.
- Insulin: manufacturer $35 programs, California's CalRx insulin and state copay caps. Use only what is verified and current.

**Local help**
- County programs for uninsured residents in Santa Clara and Monterey counties.
- HRSA health centers with sliding-fee pharmacies in the region.

**Drugs and prices**
- Cost Plus fee structure and catalog coverage for each slice drug and strength.
- GoodRx and SingleCare drug-page URLs.
- The current NADAC dataset.
- Orange Book / Purple Book entries for the slice drugs.
- Manufacturer PAPs for the slice brand drugs: status, FPL cap and insurance rules.

---

## 10. Internationalization
- **Languages:** en, es, zh-Hans and hi at launch.
- **RTL-ready:** use logical start/end properties everywhere, plus a pseudo-RTL test pass.
- **Translation quality:**
  - Write translations natively, not literally, at a grade 6–8 reading level in each language.
  - Keep a consistent per-language term glossary (how "copay", "deductible" and "income" are said).
  - Brand and program names stay in Latin script: GoodRx, SingleCare, Cost Plus, Medi-Cal, Covered California.
- **Formatting:** Intl for numbers, currency, dates and relative time ("12 days ago"); ICU plurals.
- **Checks:**
  - key parity across locales;
  - ICU placeholder parity;
  - a lint rule against hard-coded UI strings;
  - a pseudo-locale `en-XA` (accented, +40% length) to catch clipping.
- **Review list:** list machine-assisted strings in `src/i18n/REVIEW.md` for native-speaker review before store release.

---

## 11. Robustness, privacy, security
- **Offline-first.** The app is fully usable with bundled data; remote feeds only enhance it. Low-data mode respects metered connections.
- **Network calls.** Every call has a timeout of 6s or less, retries with backoff, and Zod validation. Bad JSON never crashes the app and never replaces good data.
- **Error boundaries.** Each route has one, with a friendly illustration and a Retry button. Never show a white screen.
- **Deep links.** Parameters are validated. An unknown drug gets a friendly not-found screen with search.
- **External links** open with expo-web-browser, and only if the domain is on the pack allowlist.
- **No account, no backend, no analytics by default.** If analytics are ever added, they must be opt-in, anonymous and documented.
- **Honesty linter** (`scripts/honesty-lint.ts`). It scans every locale for forbidden absolute claims using a per-language list ("guaranteed", "you qualify", "will save", "garantizado", …) and fails CI on a match.
- **Contrast checker** (`scripts/contrast-check.ts`). Every text/background token pair in every theme must meet AA: 4.5:1 for body text, 3:1 for large text and UI, 7:1 in high contrast.
- **Local and CI parity.** The data validator, link checker, i18n parity check and verification generator all run both locally and in CI.

---

## 12. Accessibility (WCAG 2.2 AA minimum)
- **Basics:** contrast as in §11, 48×48dp tap targets, and color is never the only signal.
- **Screen readers:**
  - label, role and hint on everything; a logical focus order; headings marked as headings;
  - announcements for tab changes, result counts and price updates;
  - text equivalents for the Price Ladder and the Bridge.
- **Font scaling:** up to 200% without clipping, and prices are never truncated. Test every screen at 200%.
- **Settings:** Reduce Motion and high contrast as specified; haptics are optional.
- **Glossary chips:** tap-to-explain "?" chips for NADAC, PAP, FPL, biosimilar, formulary, deductible, copay, MAGI household and other jargon.
- **Manual testing:** `docs/A11Y_CHECKLIST.md` for VoiceOver and TalkBack passes.

---

## 13. Testing and quality
- **Unit tests:** every domain module (§8) with property tests; data loaders; feed resolution; search ranking, including multi-script cases.
- **Component tests:**
  - Every price card and program card in each of its states: normal, Not listed, unknown, stale, closed and error.
  - Each rendered in all four languages and at 200% font scale.
- **E2E flows (Maestro)**
  1. Uninsured → household → income → result → search → results → help paying.
  2. Insured path with Copay Check.
  3. Offline launch.
  4. Language switch mid-flow keeps state.
  5. Deep link to a drug with strength and quantity.
  6. Navigator mode "New client" wipe.
  7. Save a medicine → My Plan reflects it.
- **Design gallery:** a dev-only route that renders every component in every state, theme and language. Use it for review screenshots.
- **Performance**
  - Cold start under 2s on a mid-range Android: Hermes, lazy routes, preloaded fonts, a small bundle and no bundled CJK fonts.
  - Long lists are virtualized.
  - Animations run at 60fps on the UI thread.
- **CI (GitHub Actions):** typecheck, lint, unit and component tests, i18n parity, honesty lint, contrast check, pack validation, and a check that the verification report is up to date. Separate scheduled workflows run the weekly NADAC refresh and the weekly link check.

---

## 14. Repo layout

```
app/                        Expo Router routes (onboarding stack, tabs, drug/[id], program/[id], sheets)
src/design/                 tokens, themes, typography, motion, components:
                            Button, Card, PriceCard, SourceChip, GlossaryChip, BridgeProgress, PeopleRow,
                            PriceLadder, FreshnessRing, Odometer, Sheet, EmptyState, ErrorBoundary
src/domain/                 pure logic: fpl, brackets, eligibility, papMatch, outlook, staleness,
                            priceMath, feedResolution, plan, search
src/data/                   zod schemas, pack loader, remote feed client
src/state/                  zustand stores + storage adapters
src/services/               speech, print, share, location, notifications, calendar, links, haptics
src/i18n/                   setup + locales/{en,es,zh-Hans,hi}.json
data/packs/ca-south-bay/    the region pack
scripts/                    refresh-nadac, snapshot-costplus, check-links, i18n-parity, honesty-lint,
                            contrast-check, validate-packs, gen-verification
e2e/                        Maestro flows
docs/                       VERIFYING.md, A11Y_CHECKLIST.md, screens/ (review screenshots)
README.md  VERIFICATION.md  eas.json  app.config.ts
```

---

## 15. How to work (phases and checkpoints)

- **Commits and help:** work in small, logical commits. Use parallel subagents for research and for independent modules.
- **Questions and assumptions:** don't ask questions you can answer with the defaults in this file. State your assumptions in the README.
- **No simulators in the cloud container.**
  - Verify the UI by running the web preview and capturing screenshots with Playwright.
  - Capture at phone sizes (390×844 and 360×800) in light and dark mode, and at 200% text where possible.
  - Say clearly what was not tested on a real device.

**Phases**
1. **Research and verify the slice:** §9.4 for the three slice drugs plus the region basics. Output: draft packs and `VERIFICATION.md`.
2. **Foundation:** scaffold, tokens, themes, fonts, i18n, storage, navigation, error boundaries, CI and scripts.
3. **Vertical slice:** onboarding → coverage result → search → strength and quantity → Results (both tabs) for the three slice drugs, with every state, every signature moment and all four languages.
   - **Checkpoint** (if `pause_for_review_after_slice`): stop and show me screenshots of every screen and state (from the gallery), the Zod schemas and any open questions. Wait for my go-ahead before scaling data.
4. **The rest:** My Plan, My medicines, Get help, the tracker, call coach, counter card, share/print, the Medicare panel, navigator mode, settings, read aloud and reminders.
5. **Scale the data** to `full_drug_list_size`: pharmacies, programs, clinics and the scheduled Actions.
6. **Polish:**
   - accessibility, 200%-text and performance passes;
   - E2E tests and EAS config;
   - store metadata (name, description and permission strings in every launch language);
   - README.

**At the end of each phase, report:** what was built, screenshots, what's verified vs. not shipped, any deviations from this prompt and why, and next steps.

---

## 16. Definition of done
- [ ] `npx expo start` runs in Expo Go on iOS and Android, and the web preview renders.
- [ ] Zero placeholder text, zero hard-coded UI strings, zero `any`.
- [ ] Every fact on screen has a source chip, and `VERIFICATION.md` is generated and current.
- [ ] All CI checks are green.
- [ ] Every screen is checked at 200% text, in dark mode, in high contrast, with Reduce Motion, and in all four languages.
- [ ] Offline launch works with bundled data.
- [ ] The README covers: purpose; how to run (device and web); how to refresh data; how to add a region, language or drug; data sources with links and dates; the honesty rules; and assumptions.

---

## 17. Never
- Never show a coupon dollar amount, an unverified fact, or a price attached to a specific pharmacy store.
- Never say someone qualifies, will save money, or that a generic will launch on a specific date.
- Never give medical advice.
- Never collect immigration status, SSN or identity information. Never send personal data off the device.
- Never add an LLM chatbot or generated advice inside the app.
- Never use flags for languages, icon-only buttons or color-only status.
- Never ship placeholder copy ("APP NAME", "Lorem", "TODO") or a button whose label doesn't name where it goes.
- Never hard-code FPL years, thresholds, fees or program rules in components.
