import { HelpCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { getPack } from '@/data/pack';
import { pickLocalized } from '@/data/localize';
import { useUi } from '@/state/ui';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, radius, spacing } from '../tokens';
import { Tappable } from './Tappable';

/** Tap-to-explain chip for jargon (NADAC, PAP, FPL, biosimilar...). */
export function GlossaryChip({ termId, label }: { termId: string; label?: string }) {
  const { palette, lang } = useTheme();
  const { t } = useTranslation('common');
  const openSheet = useUi((s) => s.openSheet);
  const term = getPack().glossary.find((g) => g.id === termId);
  if (!term) return null;
  const text = label ?? pickLocalized(term.term, lang).text;
  return (
    <Tappable
      onPress={() => openSheet({ kind: 'glossary', termId })}
      accessibilityLabel={t('glossary.whatIs', { term: text })}
      style={[styles.chip, { borderColor: palette.signals.lilac.solid, backgroundColor: palette.signals.lilac.tint }]}>
      <HelpCircle size={16} color={palette.signals.lilac.ink} />
      <Text variant="caption" bold style={{ color: palette.signals.lilac.ink }}>
        {text}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTap - 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
