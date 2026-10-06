import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronLeft, ChevronRight, Sun, SunDim, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrugNotFound } from '@/components/results/DrugNotFound';
import { countText, resultsT } from '@/components/results/labels';
import { resolveSelection } from '@/components/results/params';
import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import {
  Button,
  CONTENT_MAX_WIDTH,
  highContrastDarkPalette,
  highContrastLightPalette,
  minTap,
  motion,
  radius,
  ReadAloud,
  spacing,
  Tappable,
  Text,
  typeScale,
  useTheme,
} from '@/design';
import { LANGUAGES, type Lang } from '@/i18n/languages';
import { useSettings } from '@/state/settings';

type CardText = { en: string; local: string | null };

/**
 * Pharmacy Counter Card: a full-screen, high-contrast card to show at the counter.
 * English on top, the person's language below. Visible Previous/Next buttons (no
 * swipe-only gestures), screen kept awake, optional brighter screen restored on close.
 */
export default function CounterCardScreen() {
  useKeepAwake();
  const { t } = useTranslation('results');
  const { lang: appLang, scheme, reduceMotion, textScale } = useTheme();
  const navigatorMode = useSettings((s) => s.navigatorMode);
  const clientLanguage = useSettings((s) => s.clientLanguage);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ drug?: string; strength?: string; qty?: string }>();
  const resolved = resolveSelection(getPack(), { id: params.drug, strength: params.strength, qty: params.qty });
  const hc = scheme === 'dark' ? highContrastDarkPalette : highContrastLightPalette;
  const second: Lang = navigatorMode && clientLanguage ? clientLanguage : appLang;

  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [bright, setBright] = useState(false);
  const original = useRef<number | null>(null);
  const canBrighten = Platform.OS !== 'web';

  // Put the screen back the way it was.
  useEffect(
    () => () => {
      if (original.current !== null) void Brightness.setBrightnessAsync(original.current).catch(() => undefined);
    },
    [],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/find' as Href));

  if (resolved.status !== 'ok') {
    return (
      <View style={[styles.root, { backgroundColor: hc.bg, paddingTop: insets.top + spacing.md }]}>
        <View style={styles.inner}>
          <DrugNotFound />
        </View>
      </View>
    );
  }

  const { medication, strength, selection } = resolved;
  const tEn = resultsT('en');
  const tL = resultsT(second);
  const q1 = (tt: typeof tEn, l: Lang) =>
    tt('counter.q1', {
      drug: loc(medication.displayName, l),
      strength: loc(strength.label, l),
      qty: countText(tt, strength, selection.quantity, l),
    });
  const cards: CardText[] = [
    { en: q1(tEn, 'en'), local: second === 'en' ? null : q1(tL, second) },
    { en: tEn('counter.q2'), local: second === 'en' ? null : tL('counter.q2') },
    { en: tEn('counter.q3'), local: second === 'en' ? null : tL('counter.q3') },
  ];
  const pageWidth = Math.min(width, CONTENT_MAX_WIDTH + spacing.md * 2);

  const goTo = (next: number) => {
    const p = Math.max(0, Math.min(cards.length - 1, next));
    setPage(p);
    scroller.current?.scrollTo({ x: p * pageWidth, animated: !reduceMotion });
    AccessibilityInfo.announceForAccessibility(t('counter.page', { page: p + 1, total: cards.length }));
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    if (p !== page) setPage(Math.max(0, Math.min(cards.length - 1, p)));
  };

  const toggleBright = async () => {
    try {
      if (!bright) {
        if (original.current === null) original.current = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
        setBright(true);
      } else {
        if (original.current !== null) await Brightness.setBrightnessAsync(original.current);
        setBright(false);
      }
    } catch {
      setBright(false);
    }
  };

  const bigSize = typeScale.display.size * 1.05 * textScale;
  const localSize = typeScale.title.size * textScale;

  return (
    <View style={[styles.root, { backgroundColor: hc.bg, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]} testID="counter-card">
      <View style={[styles.bar, styles.inner]}>
        <Button variant="secondary" compact icon={X} label={t('counter.close')} hint={t('counter.closeLabel')} onPress={close} testID="counter-close" />
        <View style={styles.flex} />
        {canBrighten ? (
          <Button
            variant={bright ? 'primary' : 'secondary'}
            compact
            icon={bright ? SunDim : Sun}
            label={bright ? t('counter.normal') : t('counter.brighter')}
            onPress={() => void toggleBright()}
            testID="counter-brightness"
          />
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={Platform.OS === 'web' ? onScrollEnd : undefined}
        style={[styles.pager, { width: pageWidth }]}
        contentContainerStyle={{ alignItems: 'stretch' }}>
        {cards.map((c, i) => (
          <View key={i} style={{ width: pageWidth, paddingHorizontal: spacing.md }} accessibilityElementsHidden={i !== page} importantForAccessibility={i === page ? 'auto' : 'no-hide-descendants'}>
            <ScrollView contentContainerStyle={styles.pageScroll}>
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}
                style={[styles.card, { backgroundColor: hc.surface, borderColor: hc.border }]}
                testID={`counter-page-${i + 1}`}>
                <Text
                  accessibilityLanguage={LANGUAGES.en.intlTag}
                  style={{ color: hc.text, fontSize: bigSize, lineHeight: Math.round(bigSize * 1.25), fontWeight: '700' }}
                  variant="display">
                  {c.en}
                </Text>
                <ReadAloud text={c.en} lang="en" label={t('counter.listenIn', { language: LANGUAGES.en.nativeName })} />
                {c.local ? (
                  <>
                    <View style={[styles.rule, { backgroundColor: hc.border }]} />
                    <Text
                      accessibilityLanguage={LANGUAGES[second].intlTag}
                      variant="title"
                      style={{ color: hc.text, fontSize: localSize, lineHeight: Math.round(localSize * 1.4) }}>
                      {c.local}
                    </Text>
                    <ReadAloud text={c.local} lang={second} label={t('counter.listenIn', { language: LANGUAGES[second].nativeName })} />
                  </>
                ) : null}
              </Animated.View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.inner, styles.nav]}>
        <View style={styles.dots} accessibilityRole="tablist">
          {cards.map((_, i) => (
            <Tappable
              key={i}
              onPress={() => goTo(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === page }}
              accessibilityLabel={t('counter.goTo', { page: i + 1 })}
              style={styles.dotHit}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i === page ? hc.text : 'transparent', borderColor: hc.text, width: i === page ? 28 : 12 },
                ]}
              />
            </Tappable>
          ))}
        </View>
        <Text variant="label" bold center style={{ color: hc.text }} accessibilityLiveRegion="polite" testID="counter-page-label">
          {t('counter.page', { page: page + 1, total: cards.length })}
        </Text>
        <View style={styles.navButtons}>
          <Button
            variant="secondary"
            icon={ChevronLeft}
            label={t('counter.previous')}
            hint={t('counter.previousLabel')}
            onPress={() => goTo(page - 1)}
            disabled={page === 0}
            testID="counter-previous"
            style={styles.navButton}
          />
          <Button
            variant="primary"
            icon={ChevronRight}
            label={t('counter.next')}
            hint={t('counter.nextLabel')}
            onPress={() => goTo(page + 1)}
            disabled={page === cards.length - 1}
            testID="counter-next"
            style={styles.navButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, paddingHorizontal: spacing.md },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: minTap },
  flex: { flex: 1 },
  pager: { flex: 1, marginVertical: spacing.sm },
  pageScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.sm },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 3 },
  rule: { height: 2, marginVertical: spacing.xxs },
  nav: { gap: spacing.xs },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xxs },
  dotHit: { minWidth: minTap, minHeight: minTap, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 12, borderRadius: 6, borderWidth: 2 },
  navButtons: { flexDirection: 'row', gap: spacing.sm },
  navButton: { flex: 1 },
});
