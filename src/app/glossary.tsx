import { BookOpen } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import { SearchField } from '@/components/help/SearchField';
import { pickLocalized } from '@/data/localize';
import { getPack } from '@/data/pack';
import { EmptyState, ListRow, Screen, Text, useTheme, VStack } from '@/design';
import { useUi } from '@/state/ui';

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Every glossary word, searchable in the person's language (and English). Tap → the glossary sheet. */
export default function GlossaryScreen() {
  const { t } = useTranslation('help');
  const { lang } = useTheme();
  const openSheet = useUi((s) => s.openSheet);
  const [query, setQuery] = useState('');

  const terms = useMemo(
    () =>
      getPack()
        .glossary.map((g) => {
          const term = pickLocalized(g.term, lang).text;
          const def = pickLocalized(g.definition, lang).text;
          return { id: g.id, term, def, haystack: fold(`${term} ${def} ${g.term.en} ${g.id}`) };
        })
        .sort((a, b) => a.term.localeCompare(b.term, lang)),
    [lang],
  );

  const q = fold(query.trim());
  const shown = q ? terms.filter((x) => x.haystack.includes(q)) : terms;

  // Announce how many words match (not on first render).
  const count = t('glossary.count', { count: shown.length });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    AccessibilityInfo.announceForAccessibility(count);
  }, [count]);

  return (
    <Screen back title={t('glossary.title')} testID="glossary-screen">
      <Text tone="muted">{t('glossary.intro')}</Text>
      <SearchField
        testID="glossary-search"
        value={query}
        onChange={setQuery}
        label={t('glossary.search')}
        placeholder={t('glossary.searchPlaceholder')}
        clearLabel={t('glossary.clear')}
      />
      <Text variant="label" bold tone="muted" accessibilityLiveRegion="polite">
        {count}
      </Text>
      {shown.length === 0 ? (
        <EmptyState illustration="magnifier" title={t('glossary.none', { query: query.trim() })} body={t('glossary.noneBody')} />
      ) : (
        <VStack gap="sm">
          {shown.map((x) => (
            <ListRow
              key={x.id}
              testID={`glossary-${x.id}`}
              icon={BookOpen}
              signal="lilac"
              title={x.term}
              subtitle={firstSentence(x.def)}
              accessibilityHint={t('glossary.open', { term: x.term })}
              onPress={() => openSheet({ kind: 'glossary', termId: x.id })}
            />
          ))}
        </VStack>
      )}
    </Screen>
  );
}

/** First sentence of a definition, for the row preview (the sheet shows the whole text). */
function firstSentence(text: string): string {
  const m = /^.+?[.。।!?](\s|$)/u.exec(text);
  return m ? m[0].trim() : text;
}
