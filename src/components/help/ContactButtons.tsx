import { Globe, Navigation, Phone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, HStack } from '@/design';
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
        <Button
          compact
          variant="secondary"
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
        <Button
          compact
          variant="secondary"
          icon={Navigation}
          label={t('contact.directions')}
          testID={`${testIDPrefix}-directions`}
          onPress={() => void directions(address, lat, lng)}
        />
      ) : null}
      {url ? (
        <Button
          compact
          variant="secondary"
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
