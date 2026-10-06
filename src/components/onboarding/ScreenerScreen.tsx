import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ReadAloud, Screen, spacing, Text } from '@/design';
import { useScreener } from '@/state/screener';

import { BridgeProgress } from './BridgeProgress';
import { PREVIOUS_ROUTE, STEP_OF_ROUTE, type ScreenerRoute } from './steps';

/**
 * Remembers this screen as the place to resume after a restart, and returns a back handler
 * that still works when there is no history (a resumed screen is the only one in the stack).
 */
export function useScreenerRoute(route: ScreenerRoute) {
  const update = useScreener((s) => s.update);
  useFocusEffect(
    useCallback(() => {
      update({ lastRoute: route });
    }, [route, update]),
  );
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(PREVIOUS_ROUTE[route] as Href);
  }, [route]);
}

/** Every screener screen: back button, the Bridge, the question (with Listen), content and one footer action. */
export function ScreenerScreen({
  route,
  title,
  subtitle,
  children,
  footer,
  testID,
}: {
  route: ScreenerRoute;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  const back = useScreenerRoute(route);
  const { t } = useTranslation('onboarding');
  const spoken = subtitle ? `${title} ${subtitle}` : title;
  return (
    <Screen
      back={back}
      right={<ReadAloud text={spoken} label={t('listen')} />}
      top={<BridgeProgress step={STEP_OF_ROUTE[route]} />}
      footer={footer}
      testID={testID}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{title}</Text>
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}
