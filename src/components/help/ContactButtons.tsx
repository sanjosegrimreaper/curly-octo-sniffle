import { ExternalLink, Globe, Navigation, Phone, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HStack, minTap, radius, spacing, Tappable, Text, useTheme } from '@/design';
import { call, directions, openExternal } from '@/services/links';
import { useUi } from '@/state/ui';

import { hostOf } from '../home/format';

/** Call / Website / Directions buttons. Each label names where it goes; missing data shows no button. */
export function ContactButtons({
  phone,
  url,
  address,
  lat,
  lng,
  testIDPrefix,
}: {
  phone?: string | null;
  url?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  testIDPrefix: string;
}) {
  const { t } = useTranslation('help');
  if (!phone && !url && !address) return null;
  return (
    <HStack gap="xs">
      {phone ? (
        <ContactButton
          icon={Phone}
          label={t('contact.call', { phone })}
          testID={`${testIDPrefix}-call`}
          onPress={async () => {
            const ok = await call(phone);
            if (!ok) useUi.getState().showToast(t('contact.callFailed', { phone }), 'info');
          }}
        />
      ) : null}
      {address ? (
        <ContactButton
          icon={Navigation}
          label={t('contact.directions')}
          testID={`${testIDPrefix}-directions`}
          onPress={() => void directions(address, lat, lng)}
        />
      ) : null}
      {url ? (
        <ContactButton
          icon={Globe}
          external
          label={t('contact.website', { host: hostOf(url) })}
          testID={`${testIDPrefix}-website`}
          onPress={() => void openExternal(url)}
        />
      ) : null}
    </HStack>
  );
}

/**
 * Secondary pill button whose label shrinks and wraps inside the pill (long web addresses
 * never push the link icon onto its own line or past the card edge).
 */
function ContactButton({
  icon: Icon,
  label,
  onPress,
  external,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  external?: boolean;
  testID?: string;
}) {
  const { palette } = useTheme();
  const { t } = useTranslation('common');
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={external ? t('opensWebsite') : undefined}
      style={[styles.btn, { borderColor: palette.accent, backgroundColor: palette.surface }]}>
      <View style={styles.row}>
        <Icon size={20} color={palette.accentInk} />
        <Text variant="label" bold style={{ color: palette.accentInk, flexShrink: 1 }}>
          {label}
        </Text>
        {external ? <ExternalLink size={16} color={palette.accentInk} /> : null}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: minTap,
    maxWidth: '100%',
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
});
