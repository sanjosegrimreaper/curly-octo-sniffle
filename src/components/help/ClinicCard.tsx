import { CircleHelp, HandCoins, MapPin, Pill } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { loc } from '@/data/localize';
import type { Clinic } from '@/data/schemas';
import { Badge, Card, HStack, SourceChip, spacing, Text, useTheme } from '@/design';
import { LANGUAGES, isLang } from '@/i18n/languages';

import { ContactButtons } from './ContactButtons';

/**
 * One community clinic. Pharmacy and sliding-fee badges show only what the source says;
 * unknown is "Call to confirm", never assumed.
 */
export function ClinicCard({ clinic }: { clinic: Clinic }) {
  const { t } = useTranslation('help');
  const { palette, lang } = useTheme();
  const line2 = [clinic.city, clinic.zip].filter(Boolean).join(' ');
  const fullAddress = `${clinic.address}, ${clinic.city}, CA${clinic.zip ? ` ${clinic.zip}` : ''}`;
  const languages = clinic.languages.map((l) => (isLang(l) ? LANGUAGES[l].nativeName : l));

  return (
    <Card testID={`clinic-${clinic.id}`}>
      <Text variant="subheading">{clinic.name}</Text>
      {clinic.organization !== clinic.name ? (
        <Text variant="label" tone="muted">
          {clinic.organization}
        </Text>
      ) : null}
      <View style={styles.address}>
        <MapPin size={18} color={palette.textMuted} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{clinic.address}</Text>
          <Text variant="label">{line2}</Text>
        </View>
      </View>
      <HStack gap="xs">
        {clinic.hasPharmacy === true ? (
          <Badge label={t('clinics.pharmacy')} signal="mint" icon={Pill} />
        ) : clinic.hasPharmacy === null ? (
          <Badge label={t('clinics.pharmacyUnknown')} signal="sunflower" icon={CircleHelp} />
        ) : (
          <Badge label={t('clinics.pharmacyNo')} signal="slate" />
        )}
        {clinic.slidingFee === true ? (
          <Badge label={t('clinics.slidingFee')} signal="lilac" icon={HandCoins} />
        ) : clinic.slidingFee === null ? (
          <Badge label={t('clinics.slidingFeeUnknown')} signal="sunflower" icon={CircleHelp} />
        ) : (
          <Badge label={t('clinics.slidingFeeNo')} signal="slate" />
        )}
      </HStack>
      {clinic.pharmacyHours ? (
        <Text variant="label">{t('clinics.pharmacyHours', { hours: loc(clinic.pharmacyHours, lang) })}</Text>
      ) : null}
      {languages.length > 0 ? (
        <Text variant="label" tone="muted">
          {t('clinics.languages', { languages: languages.join(', ') })}
        </Text>
      ) : null}
      {!clinic.phone ? (
        <Text variant="caption" tone="muted">
          {t('clinics.phoneNotListed')}
        </Text>
      ) : null}
      <ContactButtons
        phone={clinic.phone}
        url={clinic.url}
        address={fullAddress}
        lat={clinic.lat}
        lng={clinic.lng}
        testIDPrefix={`clinic-${clinic.id}`}
      />
      <SourceChip sources={clinic.sources} verifiedAsOf={clinic.verifiedAsOf} recordId={`clinic:${clinic.id}`} title={clinic.name} />
    </Card>
  );
}

const styles = StyleSheet.create({
  address: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
});
