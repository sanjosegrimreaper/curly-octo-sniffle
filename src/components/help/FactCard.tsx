import { HStack, Card, GlossaryChip, ReadAloud, SourceChip, Text, useTheme } from '@/design';
import { pickLocalized } from '@/data/localize';
import type { Fact } from '@/data/schemas';
import { useTranslation } from 'react-i18next';

/** Fact ids that have a glossary word worth explaining next to them. */
const GLOSSARY_FOR_FACT: Record<string, string> = {
  'medicare-extra-help-2026': 'extra-help',
};

/** A verified fact (e.g. the Medicare Part D cap) as a card with read-aloud and its source. */
export function FactCard({ fact }: { fact: Fact }) {
  const { lang } = useTheme();
  const { t } = useTranslation('common');
  const title = pickLocalized(fact.title, lang);
  const body = pickLocalized(fact.body, lang);
  const glossary = GLOSSARY_FOR_FACT[fact.id];
  return (
    <Card signal="lilac" treatment="outline" testID={`fact-${fact.id}`}>
      <Text variant="subheading">{title.text}</Text>
      <Text>{body.text}</Text>
      {title.fellBack || body.fellBack ? (
        <Text variant="caption" tone="muted">
          {t('notTranslated')}
        </Text>
      ) : null}
      <HStack gap="xs">
        <ReadAloud text={`${title.text}. ${body.text}`} />
        {glossary ? <GlossaryChip termId={glossary} /> : null}
      </HStack>
      <SourceChip sources={fact.sources} verifiedAsOf={fact.verifiedAsOf} recordId={`fact:${fact.id}`} title={title.text} />
    </Card>
  );
}
