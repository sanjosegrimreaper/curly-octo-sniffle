import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';

import { href, ROUTES } from '@/components/onboarding/steps';
import { LanguageTile } from '@/components/onboarding/LanguageTile';
import { WelcomeHero } from '@/components/onboarding/WelcomeHero';
import { Button, motion, radius, Screen, spacing, Text, useTheme } from '@/design';
import { LAUNCH_LANGUAGES, type Lang } from '@/i18n/languages';
import { useScreener } from '@/state/screener';
import { useSettings } from '@/state/settings';

/** First launch: pick a language (the whole app switches instantly), then start the screener or go straight to search. */
export default function WelcomeScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { palette, lang, reduceMotion, textScale } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const chosen = useSettings((s) => s.language);
  const setSetting = useSettings((s) => s.set);
  const updateScreener = useScreener((s) => s.update);
  const selected: Lang = chosen ?? lang;
  const oneColumn = textScale * fontScale >= 1.3;
  const ease = Easing.bezier(...motion.easing);

  const confirmLanguage = () => {
    if (!chosen) setSetting('language', lang);
  };
  const start = () => {
    confirmLanguage();
    router.push(href(ROUTES.coverage));
  };
  const justSearch = () => {
    confirmLanguage();
    updateScreener({ skipped: true });
    router.replace(href(ROUTES.find));
  };

  return (
    <Screen
      testID="screen-welcome"
      footer={
        <>
          <Button label={t('welcome.start')} hint={t('welcome.startHint')} onPress={start} testID="welcome-start" />
          <Button
            variant="secondary"
            label={t('welcome.justSearch')}
            hint={t('welcome.justSearchHint')}
            onPress={justSearch}
            testID="welcome-just-search"
          />
        </>
      }>
      <View style={{ paddingTop: spacing.md }}>
        <WelcomeHero width={Math.min(300, width - spacing.xl * 2)} />
      </View>

      {/* Crossfades whenever the language changes. */}
      <Animated.View
        key={lang}
        entering={reduceMotion ? undefined : FadeIn.duration(motion.slow).easing(ease)}
        style={{ gap: spacing.xs }}>
        <Text variant="display" center>
          {tc('appName')}
        </Text>
        <Text variant="subheading" center tone="muted" testID="welcome-purpose">
          {t('welcome.purpose')}
        </Text>
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(120).duration(motion.slow).easing(ease)}
        style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        <Text variant="label" bold tone="muted" accessibilityRole="header">
          {t('welcome.chooseLanguage')}
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('welcome.chooseLanguage')}
          style={{ flexDirection: oneColumn ? 'column' : 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {LAUNCH_LANGUAGES.map((code) => (
            <LanguageTile
              key={code}
              code={code}
              selected={selected === code}
              wide={oneColumn}
              onPress={() => setSetting('language', code)}
            />
          ))}
        </View>
        <Text variant="caption" tone="muted" center>
          {t('welcome.changeLater')}
        </Text>
      </Animated.View>

      <View
        accessible
        accessibilityLabel={t('welcome.privacy')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          alignSelf: 'center',
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: palette.signals.mint.tint,
        }}
        testID="welcome-privacy">
        <Lock size={18} color={palette.signals.mint.ink} />
        <Text variant="label" bold tone="mint" style={{ flexShrink: 1 }}>
          {t('welcome.privacy')}
        </Text>
      </View>
    </Screen>
  );
}
