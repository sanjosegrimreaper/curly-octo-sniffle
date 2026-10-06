import { useFocusEffect } from 'expo-router';
import { Square, Volume2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import type { Lang } from '@/i18n/languages';
import { speak, stopSpeaking } from '@/services/speech';
import { useUi } from '@/state/ui';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, radius, spacing } from '../tokens';
import { Tappable } from './Tappable';

/** Speaker button: reads `text` aloud in the current (or given) language. Stops when the screen loses focus. */
export function ReadAloud({ text, lang, label }: { text: string; lang?: Lang; label?: string }) {
  const { palette, lang: themeLang } = useTheme();
  const { t } = useTranslation('common');
  const [speaking, setSpeaking] = useState(false);
  const showToast = useUi((s) => s.showToast);
  const language = lang ?? themeLang;

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopSpeaking();
        setSpeaking(false);
      };
    }, []),
  );

  const onPress = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const ok = await speak(text, language, () => setSpeaking(false));
    if (!ok) {
      setSpeaking(false);
      showToast(t('readAloud.noVoice'), 'caution');
    }
  };

  const Icon = speaking ? Square : Volume2;
  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={speaking ? t('readAloud.stop') : (label ?? t('readAloud.start'))}
      style={[styles.btn, { borderColor: palette.border, backgroundColor: palette.surface }]}>
      <Icon size={20} color={palette.accentInk} />
      <Text variant="caption" bold tone="accent">
        {speaking ? t('readAloud.stopShort') : t('readAloud.short')}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: minTap,
    minWidth: minTap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
