import { router, useLocalSearchParams, type Href } from 'expo-router';
import { AlertTriangle, FileDown, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { DrugNotFound } from '@/components/results/DrugNotFound';
import { hasResultsTranslation, resultsT } from '@/components/results/labels';
import { deepLink, resolveSelection } from '@/components/results/params';
import { summaryColumn, summaryHtml, summarySources, type SummaryColumn } from '@/components/results/summary';
import { getPack } from '@/data/pack';
import { todayISO } from '@/domain';
import { Button, Card, HeaderButton, motion, radius, Screen, spacing, Text, useTheme } from '@/design';
import { useProfile } from '@/hooks/useProfile';
import { usePriceSummary } from '@/hooks/usePrices';
import { LANGUAGES, type Lang } from '@/i18n/languages';
import { qrSvg, shareHtmlAsPdf } from '@/services/print';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

/** Share & print: a bilingual one-page summary, previewed here and shared as a PDF. */
export default function ShareScreen() {
  const { t } = useTranslation('results');
  const { palette, lang: appLang, reduceMotion, textScale } = useTheme();
  const { width } = useWindowDimensions();
  const navigatorMode = useSettings((s) => s.navigatorMode);
  const clientLanguage = useSettings((s) => s.clientLanguage);
  const showToast = useUi((s) => s.showToast);
  const profile = useProfile();
  const params = useLocalSearchParams<{ drug?: string; strength?: string; qty?: string }>();
  const pack = getPack();
  const resolved = useMemo(
    () => resolveSelection(pack, { id: params.drug, strength: params.strength, qty: params.qty }),
    [pack, params.drug, params.strength, params.qty],
  );
  const selection = resolved.status === 'ok' ? resolved.selection : null;
  const summary = usePriceSummary(selection);
  const [includeProfile, setIncludeProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');

  // The person's language (or the client's, in navigator mode) next to English.
  const wanted: Lang = navigatorMode && clientLanguage ? clientLanguage : appLang;
  // Not translated yet → English only (never the same English twice).
  const second: Lang = hasResultsTranslation(wanted, 'share.docTitle') ? wanted : 'en';
  const langs: Lang[] = second === 'en' ? ['en'] : [second, 'en'];
  const today = todayISO();

  const columns = useMemo<SummaryColumn[]>(() => {
    if (!summary) return [];
    const p = includeProfile ? { householdSize: profile.householdSize, income: profile.income } : null;
    return langs.map((l) => summaryColumn(pack, summary, resultsT(l), l, { today, profile: p }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, includeProfile, profile, second, today, pack]);

  useEffect(() => {
    if (!selection) return;
    let live = true;
    void qrSvg(deepLink(selection)).then((svg) => live && setQr(svg));
    return () => {
      live = false;
    };
  }, [selection]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/find' as Href));

  if (resolved.status !== 'ok' || !summary || !selection) {
    return (
      <Screen right={<HeaderButton icon={X} label={t('counter.close')} onPress={close} />} testID="share-screen">
        <DrugNotFound />
      </Screen>
    );
  }

  const sharePdf = async () => {
    setBusy(true);
    const html = summaryHtml(columns, summarySources(pack, summary), qr, t('share.fileTitle'));
    const result = await shareHtmlAsPdf(html, t('share.fileTitle'));
    setBusy(false);
    if (result === 'failed') showToast(t('share.failed'), 'caution');
    else showToast(result === 'shared' ? t('share.shared') : t('share.printed'), 'success');
  };

  const sideBySide = columns.length > 1 && width >= 600 && textScale <= 1.15;

  return (
    <Screen
      right={<HeaderButton icon={X} label={t('counter.close')} onPress={close} testID="share-close" />}
      testID="share-screen"
      footer={
        <>
          <View style={styles.warning}>
            <AlertTriangle size={18} color={palette.signals.sunflower.ink} />
            <Text variant="label" bold tone="sunflower" style={styles.flex}>
              {t('share.warning')}
            </Text>
          </View>
          <Button icon={FileDown} label={t('share.pdf')} hint={t('share.pdfHint')} onPress={() => void sharePdf()} loading={busy} testID="share-pdf" />
        </>
      }>
      <View style={styles.head}>
        <Text variant="title">{t('share.title')}</Text>
        <Text tone="muted">{langs.length > 1 ? t('share.subtitle') : t('share.subtitleOne')}</Text>
      </View>

      <Card style={styles.switchRow}>
        <View style={styles.flex}>
          <Text bold>{t('share.includeProfile')}</Text>
          <Text variant="caption" tone="muted">
            {t('share.includeProfileHint')}
          </Text>
        </View>
        <Switch
          value={includeProfile}
          onValueChange={setIncludeProfile}
          accessibilityLabel={t('share.includeProfile')}
          trackColor={{ false: palette.borderStrong, true: palette.accent }}
          thumbColor={palette.surface}
          testID="share-include-profile"
        />
      </Card>

      <Text variant="label" bold tone="accent">
        {t('share.preview')}
      </Text>
      <View style={[styles.paper, sideBySide && styles.paperRow, { backgroundColor: palette.surface, borderColor: palette.borderStrong }]} testID="share-preview">
        {columns.map((c, i) => (
          <Animated.View
            key={c.lang}
            entering={reduceMotion ? undefined : FadeInDown.delay(i * 80).duration(motion.slow)}
            style={[styles.column, sideBySide ? styles.flex : null, i > 0 && !sideBySide ? [styles.columnDivider, { borderTopColor: palette.border }] : null]}>
            <Text variant="caption" bold tone="muted">
              {LANGUAGES[c.lang].nativeName}
            </Text>
            <Text variant="heading" accessibilityLanguage={LANGUAGES[c.lang].intlTag}>
              {c.title}
            </Text>
            {c.sections.map((s) => (
              <View key={s.id} style={styles.section}>
                <Text variant="label" bold accessibilityLanguage={LANGUAGES[c.lang].intlTag} style={[styles.sectionHead, { borderBottomColor: palette.text }]}>
                  {s.heading}
                </Text>
                {s.lines.map((l, j) => (
                  <View key={j} style={styles.line}>
                    <Text variant="label" accessibilityLanguage={LANGUAGES[c.lang].intlTag}>
                      {l.text}
                    </Text>
                    {l.sub ? (
                      <Text variant="caption" tone="muted" accessibilityLanguage={LANGUAGES[c.lang].intlTag}>
                        {l.sub}
                      </Text>
                    ) : null}
                    {l.unconfirmed ? (
                      <Text variant="caption" bold tone="sunflower">
                        {c.unconfirmedLabel}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
            <Text variant="caption" tone="muted">
              {c.generated}
            </Text>
          </Animated.View>
        ))}
        {qr ? (
          <View style={styles.qr} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={styles.qrBox}>
              <SvgXml xml={qr} width={112} height={112} />
            </View>
            <Text variant="caption" center tone="muted">
              {columns.map((c) => c.scan).join(' / ')}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xxs },
  flex: { flex: 1 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingVertical: spacing.xxs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  paper: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  paperRow: { flexDirection: 'row', flexWrap: 'wrap' },
  column: { gap: spacing.sm, minWidth: 240 },
  columnDivider: { borderTopWidth: 1, paddingTop: spacing.md },
  section: { gap: spacing.xxs },
  sectionHead: { borderBottomWidth: 1.5, paddingBottom: 2 },
  line: { gap: 1, paddingLeft: spacing.xs },
  qr: { alignItems: 'center', gap: spacing.xs, flexBasis: '100%' },
  qrBox: { backgroundColor: '#FFFFFF', padding: spacing.xs, borderRadius: radius.sm },
});
