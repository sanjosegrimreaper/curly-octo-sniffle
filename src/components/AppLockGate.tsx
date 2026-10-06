import * as LocalAuthentication from 'expo-local-authentication';
import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, View } from 'react-native';

import { Button, GraphPaper, Illustration, spacing, Text } from '@/design';
import { useSettings } from '@/state/settings';

const RELOCK_AFTER_MS = 60_000;

/** Optional lock (Face ID / fingerprint / device PIN) because a medicine list is sensitive. */
export function AppLockGate({ children }: { children: ReactNode }) {
  const appLock = useSettings((s) => s.appLock);
  const { t } = useTranslation('common');
  const [locked, setLocked] = useState(appLock && Platform.OS !== 'web');
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: t('lock.prompt'),
        cancelLabel: t('cancel'),
        disableDeviceFallback: false,
      });
      if (res.success) setLocked(false);
    } catch {
      // keep locked; the button stays available
    }
  }, [t]);

  useEffect(() => {
    if (!appLock || Platform.OS === 'web') {
      setLocked(false);
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
    });
    return () => sub.remove();
  }, [appLock]);

  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  if (!locked) return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
      <GraphPaper />
      <Illustration name="shield" />
      <Text variant="title" center>
        {t('lock.title')}
      </Text>
      <Text tone="muted" center>
        {t('lock.body')}
      </Text>
      <Button icon={Lock} label={t('lock.unlock')} onPress={() => void unlock()} />
    </View>
  );
}
