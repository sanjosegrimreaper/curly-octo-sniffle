import { UserRoundPlus, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, radius, spacing, Text, useTheme } from '@/design';
import { i18next } from '@/i18n';
import { LANGUAGES } from '@/i18n/languages';
import { wipePersonalData } from '@/state/session';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

import { confirmAction } from './confirm';

/** Asks, then clears everything about the current client. */
export function confirmNewClient() {
  const t = i18next.getFixedT(null, 'settings');
  confirmAction({
    title: t('navigator.confirmTitle'),
    body: t('navigator.confirmBody'),
    confirmLabel: t('navigator.confirm'),
    danger: true,
    testID: 'navigator-confirm',
    onConfirm: async () => {
      await wipePersonalData();
      useUi.getState().showToast(t('navigator.done'), 'success');
    },
  });
}

/** Helper (navigator) mode strip: nothing is saved, and "New client" wipes the session. */
export function NavigatorBar() {
  const on = useSettings((s) => s.navigatorMode);
  const clientLanguage = useSettings((s) => s.clientLanguage);
  const { palette } = useTheme();
  const { t } = useTranslation('settings');
  if (!on) return null;
  const s = palette.signals.lilac;
  return (
    <View
      testID="navigator-bar"
      accessibilityRole="summary"
      style={[styles.bar, { backgroundColor: s.tint, borderColor: s.solid }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: palette.surface, borderColor: s.solid }]}>
          <Users size={22} color={s.ink} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" bold style={{ color: s.ink }}>
            {t('navigator.barTitle')}
          </Text>
          <Text variant="caption">
            {clientLanguage
              ? t('navigator.clientLanguage', { language: LANGUAGES[clientLanguage].nativeName })
              : t('navigator.barBody')}
          </Text>
        </View>
      </View>
      <Button
        testID="navigator-new-client"
        compact
        variant="secondary"
        icon={UserRoundPlus}
        label={t('navigator.newClient')}
        onPress={confirmNewClient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: 2, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
