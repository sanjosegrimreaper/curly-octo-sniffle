# RxBridge architecture

This is how the code is organized and the rules every screen follows.

## Stack
- **App:** Expo SDK 57 (React Native 0.86, React 19.2, New Architecture), TypeScript strict with `noUncheckedIndexedAccess`.
- **Navigation:** Expo Router. Routes live in `src/app/`. A custom floating tab bar is built with `expo-router/ui`. Stacks give real back gestures, Android hardware back and deep links.
- **Animation:** Reanimated 4 and react-native-svg. Every animation checks `useTheme().reduceMotion`.
- **State:** Zustand with persistence (AsyncStorage). Personal stores skip disk writes in navigator mode.
- **Validation:** Zod for data packs, remote feeds and deep-link params.
- **Translations:** i18next + react-i18next. Namespaces live in `src/i18n/locales/<lang>/<ns>.json`.

## Folders
```
src/app/            routes (screens only)
src/components/     app-level components (AppLockGate, AnimatedSplash, feature widgets)
src/design/         tokens, theme, Text, primitives (Button, Card, Chip, Badge, Banner, ListRow, Segmented,
                    Screen, Sheet, SourceChip, GlossaryChip, ReadAloud, EmptyState, Illustration, FreshnessRing)
src/domain/         pure logic + tests (fpl, brackets, eligibility, papMatch, outlook, staleness, priceMath,
                    feedResolution, plan, search)
src/data/           schemas.ts (Zod), pack.ts (loader), feeds.ts (remote NADAC), localize.ts
src/state/          settings, screener, medicines, applications, ui (sheet + toast), storage
src/services/       haptics, speech, links (allowlisted external links, tel:, maps, mailto), notifications, print
src/i18n/           languages, resources, format (Intl money/date/number), locales/
data/packs/<id>/    the region data pack (JSON), validated by scripts/validate-packs.ts
scripts/            pack validation, i18n parity, honesty lint, contrast check, link check, NADAC refresh,
                    verification report
```

## Rules for every screen
1. **Use the shared pieces.** Wrap each screen in `<Screen>`. Use `Text` (never RN `Text`), `Card`, `Button`, and so on from `@/design`.
2. **No hard-coded copy.** Every string comes from `t()` in the feature's namespace. Data-pack text uses `loc(localized, lang)`.
3. **Every fact shows a `<SourceChip>`.** Pass the record's `sources`, `verifiedAsOf` and a `recordId` such as `program:bmspaf`.
4. **Keep the three price classes separate:**
   - Buy now: `Card signal="mint" treatment="solid"`.
   - Coupon: `signal="sky" treatment="outline"`, with no dollar amount.
   - Reference: `signal="slate" treatment="hatched"`.
5. **Unknown values stay unknown.** Show "Not listed" or "Call to confirm". Never estimate.
6. **Use hedged words** ("may", "could"). `scripts/honesty-lint.ts` fails CI on "guaranteed", "you qualify", "will save" and similar phrases.
7. **Accessibility:**
   - Tap targets of 48dp or more.
   - `accessibilityLabel` on icon-only controls, and `accessibilityRole` set.
   - Announce result counts and tab changes.
   - No fixed heights on text.
8. **Motion:** check `reduceMotion`. With it on, pass `entering={undefined}` and render the final state. Animations last 320ms or less (600ms for a celebration).
9. **Add `testID`s** to primary actions for Maestro E2E.

## Data flow
- `getPack()` returns the validated bundled pack, which works offline.
- `useNadacFeed()` returns the newest valid NADAC feed (bundled or cached remote).
- Screens derive everything through `src/domain/*`, which are pure and unit-tested.

## Adding a region
1. Create `data/packs/<new-id>/` with the same files.
2. Add it to `PACK_FILES` in `src/data/pack.ts`.
3. Add locale strings for any new program names.

No screen code changes are needed.
