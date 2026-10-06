import * as Location from 'expo-location';
import { Building2, Clock, LocateFixed, MapPin, Navigation, Phone, Store } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { getPack } from '@/data/pack';
import type { Clinic, Pharmacy } from '@/data/schemas';
import { Button, Card, Illustration, SourceChip, spacing, Text, useTheme } from '@/design';
import { formatNumber } from '@/i18n/format';
import { LANGUAGES, type Lang } from '@/i18n/languages';
import { call, directions, openExternal } from '@/services/links';

import { siteName } from './labels';
import { sortPlaces } from './geo';

const fullAddress = (p: { address: string; city: string; zip: string | null }) =>
  [p.address, p.city, p.zip].filter(Boolean).join(', ');

/** Localized short weekday ("Mon", "lun", "周一") for published store hours. */
const WEEKDAY_INDEX = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as const;
function weekdayName(day: keyof typeof WEEKDAY_INDEX, lang: Lang) {
  // 2024-01-01 was a Monday.
  const date = new Date(Date.UTC(2024, 0, 1 + WEEKDAY_INDEX[day], 12));
  return new Intl.DateTimeFormat(LANGUAGES[lang].intlTag, { weekday: 'short', timeZone: 'UTC' }).format(date);
}

/**
 * Where to fill it. Store addresses are listed only when the pack has checked ones; until
 * then, an honest empty state hands off to the map app (no location permission needed),
 * plus county health centers that list a pharmacy.
 */
export function WhereToFill() {
  const { t } = useTranslation('results');
  const pack = getPack();
  const clinics = pack.clinics.filter((c) => c.hasPharmacy === true);

  return (
    <View style={styles.stack}>
      {pack.pharmacies.length > 0 ? (
        <PharmacyList pharmacies={pack.pharmacies} />
      ) : (
        <Card testID="pharmacies-empty" style={styles.empty}>
          <Illustration name="storefront" size={88} />
          <Text variant="subheading" center>
            {t('fill.emptyTitle')}
          </Text>
          <Text variant="label" tone="muted" center>
            {t('fill.emptyBody')}
          </Text>
          <Button
            variant="secondary"
            compact
            icon={MapPin}
            label={t('fill.findNearby')}
            onPress={() => void directions('pharmacy')}
            testID="find-pharmacies-maps"
          />
        </Card>
      )}

      {clinics.length > 0 ? (
        <View style={styles.stack} testID="clinic-pharmacies">
          <Text variant="subheading">{t('fill.clinicsTitle')}</Text>
          <Text variant="label" tone="muted">
            {t('fill.clinicsBody')}
          </Text>
          {sortPlaces(clinics, null).map(({ place }) => (
            <ClinicRow key={place.id} clinic={place} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ClinicRow({ clinic }: { clinic: Clinic }) {
  const { t } = useTranslation('results');
  const { t: tc } = useTranslation('common');
  const { palette } = useTheme();
  const address = fullAddress(clinic);
  return (
    <Card testID={`clinic-${clinic.id}`} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: palette.signals.lilac.tint }]}>
          <Building2 size={20} color={palette.signals.lilac.ink} />
        </View>
        <View style={styles.flex}>
          <Text variant="subheading">{clinic.name}</Text>
          <Text variant="label" tone="muted">
            {address}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <Clock size={16} color={palette.signals.sunflower.ink} />
        <Text variant="label" bold tone="sunflower" style={styles.flex}>
          {t('fill.callToConfirm')}
        </Text>
      </View>
      <View style={styles.actions}>
        {clinic.phone ? (
          <Button variant="secondary" compact icon={Phone} label={tc('call')} onPress={() => void call(clinic.phone ?? '')} />
        ) : null}
        <Button
          variant="secondary"
          compact
          icon={Navigation}
          label={t('fill.directions')}
          hint={t('fill.directionsTo', { name: clinic.name })}
          onPress={() => void directions(address, clinic.lat, clinic.lng)}
          testID={`clinic-directions-${clinic.id}`}
        />
        <Button
          variant="ghost"
          compact
          external
          label={t('fill.openSite', { site: siteName(clinic.url) })}
          onPress={() => void openExternal(clinic.url)}
        />
      </View>
      <SourceChip sources={clinic.sources} verifiedAsOf={clinic.verifiedAsOf} recordId={`clinic:${clinic.id}`} title={clinic.name} />
    </Card>
  );
}

/** Checked store list (future packs): county order until the person asks to sort by distance. */
function PharmacyList({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const { t } = useTranslation('results');
  const { t: tc } = useTranslation('common');
  const { palette, lang } = useTheme();
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [locating, setLocating] = useState(false);

  const sortByDistance = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setDenied(true);
        AccessibilityInfo.announceForAccessibility(t('fill.locationDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setDenied(false);
      AccessibilityInfo.announceForAccessibility(t('fill.sortedByDistance'));
    } catch {
      setDenied(true);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.stack} testID="pharmacy-list">
      {here ? (
        <Text variant="label" tone="muted">
          {t('fill.sortedByDistance')}
        </Text>
      ) : (
        <View style={styles.stack}>
          <Button
            variant="secondary"
            compact
            icon={LocateFixed}
            label={t('fill.sortByDistance')}
            onPress={() => void sortByDistance()}
            loading={locating}
            testID="sort-by-distance"
          />
          <Text variant="caption" tone="muted">
            {denied ? t('fill.locationDenied') : t('fill.locationWhy')}
          </Text>
        </View>
      )}
      {sortPlaces(pharmacies, here).map(({ place, miles }) => (
        <Card key={place.id} testID={`pharmacy-${place.id}`} style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: palette.signals.sky.tint }]}>
              <Store size={20} color={palette.signals.sky.ink} />
            </View>
            <View style={styles.flex}>
              <Text variant="subheading">{place.name}</Text>
              <Text variant="label" tone="muted">
                {fullAddress(place)}
              </Text>
              {miles !== null ? (
                <Text variant="caption" tone="muted">
                  {t('fill.milesAway', { miles: formatNumber(Math.round(miles * 10) / 10, lang) })}
                </Text>
              ) : null}
            </View>
          </View>
          {'seeLocator' in place.hours ? (
            <Text variant="label" tone="muted">
              {t('fill.hoursSeeLocator')}
            </Text>
          ) : (
            <View>
              {place.hours.weekly.map((h) => (
                <Text key={`${h.day}${h.open}`} variant="label" tabular>
                  {`${weekdayName(h.day, lang)} ${h.open}–${h.close}` /* i18n-ignore: published hours, as data */}
                </Text>
              ))}
            </View>
          )}
          <View style={styles.actions}>
            {place.phone ? (
              <Button
                variant="secondary"
                compact
                icon={Phone}
                label={tc('call')}
                hint={t('fill.call', { name: place.name })}
                onPress={() => void call(place.phone ?? '')}
              />
            ) : null}
            <Button
              variant="secondary"
              compact
              icon={Navigation}
              label={t('fill.directions')}
              hint={t('fill.directionsTo', { name: place.name })}
              onPress={() => void directions(fullAddress(place), place.lat, place.lng)}
            />
            <Button
              variant="ghost"
              compact
              external
              label={t('fill.storePage')}
              hint={t('fill.storePageFor', { name: place.name })}
              onPress={() => void openExternal(place.locatorUrl)}
            />
          </View>
          <SourceChip sources={place.sources} verifiedAsOf={place.verifiedAsOf} recordId={`pharmacy:${place.id}`} title={place.name} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  empty: { gap: spacing.sm, paddingVertical: spacing.lg },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
