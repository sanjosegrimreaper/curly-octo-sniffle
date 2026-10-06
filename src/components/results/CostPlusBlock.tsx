import { CircleSlash, CloudOff, ListOrdered } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import type { CostPlusStatus } from '@/data/prices';
import type { Strength } from '@/data/schemas';
import { Badge, Button, Card, Chip, HStack, SourceChip, spacing, Text, useTheme } from '@/design';
import { openExternal } from '@/services/links';

import { countText } from './labels';

export const COST_PLUS_HOME = 'https://www.costplusdrugs.com/';

/**
 * What the Cost Plus snapshot says about this selection, when it is not a quote
 * (quotes render as a Buy-now card). Never a guessed number.
 */
export function CostPlusBlock({
  status,
  medicationId,
  strength,
  quantity,
  onSwitchQuantity,
}: {
  status: CostPlusStatus;
  medicationId: string;
  strength: Strength;
  quantity: number;
  onSwitchQuantity: (qty: number) => void;
}) {
  const { t } = useTranslation('results');
  const { palette, lang } = useTheme();
  const snap = getPack().costPlus;
  const chip = <SourceChip sources={snap.sources} verifiedAsOf={snap.verifiedAsOf} recordId="costplus:snapshot" title={t('costPlus.title')} />;

  if (status.status === 'quote') return null;

  if (status.status === 'otherQuantities') {
    const list = status.quantities.map((q) => countText(t, strength, q, lang)).join(', ');
    return (
      <Card signal="mint" treatment="outline" testID="costplus-other-quantities">
        <HStack gap="xs">
          <ListOrdered size={20} color={palette.signals.mint.ink} />
          <Text variant="subheading" style={styles.flex}>
            {t('costPlus.title')}
          </Text>
        </HStack>
        <Text>{t('costPlus.otherQuantities', { list })}</Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {status.quantities.map((q) => (
            <Chip
              key={q}
              label={countText(t, strength, q, lang)}
              selected={q === quantity}
              onPress={() => onSwitchQuantity(q)}
              accessibilityHint={t('costPlus.switchTo', { qty: countText(t, strength, q, lang) })}
              testID={`costplus-qty-${q}`}
            />
          ))}
        </View>
        {chip}
      </Card>
    );
  }

  if (status.status === 'notListed') {
    const note = snap.notListed.find(
      (n) => n.medicationId === medicationId && (n.strengthId === null || n.strengthId === strength.id),
    )?.note;
    return (
      <Card testID="costplus-not-listed">
        <Text variant="subheading">{t('costPlus.title')}</Text>
        <Badge label={t('costPlus.notListed')} signal="slate" icon={CircleSlash} />
        <Text variant="label" tone="muted">
          {note ? loc(note, lang) : t('costPlus.notListedBody')}
        </Text>
        {chip}
      </Card>
    );
  }

  return (
    <Card testID="costplus-not-loaded">
      <Text variant="subheading">{t('costPlus.title')}</Text>
      <Badge label={t('costPlus.notLoaded')} signal="sunflower" icon={CloudOff} />
      <Text variant="label" tone="muted">
        {t('costPlus.notLoadedBody')}
      </Text>
      <Button
        variant="secondary"
        compact
        external
        label={t('costPlus.check')}
        onPress={() => void openExternal(status.url ?? COST_PLUS_HOME)}
        testID="costplus-check"
        style={styles.button}
      />
      {chip}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  button: { alignSelf: 'flex-start' },
});
