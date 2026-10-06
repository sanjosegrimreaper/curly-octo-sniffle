import { HeartHandshake, MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { pickLocalized } from '@/data/localize';
import { getPack } from '@/data/pack';
import type { Helper } from '@/data/schemas';
import { Badge, Card, HStack, SourceChip, spacing, Text, useTheme } from '@/design';

import { ContactButtons } from './ContactButtons';

/** A free helper (HICAP, county enrollment lines...): what they do, how to reach them, and the source. */
export function HelperCard({ helper }: { helper: Helper }) {
  const { t } = useTranslation('help');
  const { t: tc } = useTranslation('common');
  const { palette, lang } = useTheme();
  const name = pickLocalized(helper.name, lang);
  const what = pickLocalized(helper.what, lang);
  const counties = getPack().region.counties;
  const countyNames = helper.counties.map((id) => counties.find((c) => c.id === id)?.name ?? id);

  return (
    <Card testID={`helper-${helper.id}`}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: palette.signals.sky.tint }]}>
          <HeartHandshake size={22} color={palette.signals.sky.ink} />
        </View>
        <Text variant="subheading" style={{ flex: 1 }}>
          {name.text}
        </Text>
      </View>
      <Text>{what.text}</Text>
      {name.fellBack || what.fellBack ? (
        <Text variant="caption" tone="muted">
          {tc('notTranslated')}
        </Text>
      ) : null}
      <HStack gap="xs">
        <Badge label={t(`helpers.for.${helper.forWhom}`)} signal="lilac" />
        {countyNames.length > 0 ? (
          <Badge label={t('helpers.countyOnly', { county: countyNames.join(', ') })} signal="slate" icon={MapPin} />
        ) : null}
      </HStack>
      {!helper.phone ? (
        <Text variant="caption" tone="muted">
          {t('contact.noPhone')}
        </Text>
      ) : null}
      <ContactButtons phone={helper.phone} url={helper.url} testIDPrefix={`helper-${helper.id}`} />
      <SourceChip sources={helper.sources} verifiedAsOf={helper.verifiedAsOf} recordId={`helper:${helper.id}`} title={name.text} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
