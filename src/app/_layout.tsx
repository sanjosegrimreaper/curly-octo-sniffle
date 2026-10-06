import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import * as Font from 'expo-font';
import * as Localization from 'expo-localization';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '@/components/AppLockGate';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { refreshFeeds, useFeeds } from '@/data/feeds';
import { ErrorBoundary, SheetHost, ThemeProvider, useTheme } from '@/design';
import { ToastHost } from '@/design/components/ToastHost';
import { i18next, initI18n, setLanguage } from '@/i18n';
import { matchDeviceLanguage } from '@/i18n/languages';
import { useApplications } from '@/state/applications';
import { useMedicines } from '@/state/medicines';
import { useScreener } from '@/state/screener';
import { useSettings } from '@/state/settings';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const PERSISTED = [useSettings, useScreener, useMedicines, useApplications, useFeeds];

function useHydrated() {
  const all = () => PERSISTED.every((s) => s.persist.hasHydrated());
  const [hydrated, setHydrated] = useState(all);
  useEffect(() => {
    if (hydrated) return;
    const unsubs = PERSISTED.map((s) => s.persist.onFinishHydration(() => all() && setHydrated(true)));
    // Storage can be unavailable (private browsing): don't wait forever.
    const timer = setTimeout(() => setHydrated(true), 1500);
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(timer);
    };
  }, [hydrated]);
  return hydrated;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = Font.useFonts({
    Fredoka_600SemiBold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
  });
  const hydrated = useHydrated();
  const language = useSettings((s) => s.language);
  const lang = language ?? matchDeviceLanguage(Localization.getLocales().map((l) => l.languageTag));

  initI18n(lang); // idempotent; switches language when it changes
  useEffect(() => setLanguage(lang), [lang]);

  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    useSettings.getState().set('lastOpenedAt', new Date().toISOString());
    if (!useSettings.getState().lowData) void refreshFeeds();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18next}>
          <ThemeProvider langOverride={lang}>
            <ThemedShell />
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedShell() {
  const { palette, scheme, reduceMotion } = useTheme();
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.bg,
        card: palette.surface,
        text: palette.text,
        border: palette.border,
        primary: palette.accent,
      },
    };
  }, [palette, scheme]);

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ErrorBoundary>
        <AppLockGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
              animation: reduceMotion ? 'fade' : 'default',
              animationDuration: reduceMotion ? 150 : undefined,
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="counter-card" options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
            <Stack.Screen name="share" options={{ presentation: 'modal' }} />
          </Stack>
        </AppLockGate>
      </ErrorBoundary>
      <SheetHost />
      <ToastHost />
      <AnimatedSplash />
    </NavThemeProvider>
  );
}
