import { ExternalLink, Flag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { getPack } from '@/data/pack';
import type { SourceRef } from '@/data/schemas';
import { isConfirmed } from '@/domain';
import { loc, pickLocalized } from '@/data/localize';
import { freshness, todayISO } from '@/domain/staleness';
import { formatDate } from '@/i18n/format';
import { email, openExternal } from '@/services/links';
import { useUi } from '@/state/ui';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Button } from './Button';
import { Card } from './Card';
import { FreshnessRing } from './FreshnessRing';
import { ReadAloud } from './ReadAloud';
import { Sheet } from './Sheet';
import { HStack, VStack } from './Stack';
import { Tappable } from './Tappable';

/** One global sheet, driven by the UI store. */
export function SheetHost() {
  const sheet = useUi((s) => s.sheet);
  const close = useUi((s) => s.closeSheet);
  const { t } = useTranslation('common');
  const { lang } = useTheme();

  if (!sheet) return null;

  if (sheet.kind === 'glossary') {
    const term = getPack().glossary.find((g) => g.id === sheet.termId);
    if (!term) return null;
    const title = pickLocalized(term.term, lang);
    const def = pickLocalized(term.definition, lang);
    return (
      <Sheet visible title={title.text} onClose={close} testID="glossary-sheet">
        <Text>{def.text}</Text>
        {def.fellBack ? (
          <Text variant="caption" tone="muted">
            {t('notTranslated')}
          </Text>
        ) : null}
        <ReadAloud text={`${title.text}. ${def.text}`} />
        <SourceList sources={term.sources} verifiedAsOf={term.verifiedAsOf} recordId={`glossary:${term.id}`} />
      </Sheet>
    );
  }

  if (sheet.kind === 'source') {
    return (
      <Sheet visible title={sheet.title} onClose={close} testID="source-sheet">
        <SourceList sources={sheet.sources} verifiedAsOf={sheet.verifiedAsOf} recordId={sheet.recordId} />
      </Sheet>
    );
  }

  return (
    <Sheet visible title={sheet.title} onClose={close}>
      {sheet.render()}
    </Sheet>
  );
}

function SourceList({ sources, verifiedAsOf, recordId }: { sources: SourceRef[]; verifiedAsOf: string; recordId: string }) {
  const { t } = useTranslation('common');
  const { palette, lang } = useTheme();
  const pack = getPack();
  const f = freshness(verifiedAsOf, todayISO());

  const confirmed = isConfirmed(sources);
  const canReport = Boolean(pack.region.reportProblemEmail || pack.region.reportProblemUrl);
  const report = () => {
    const subject = t('source.reportSubject', { id: recordId });
    const body = t('source.reportBody', { id: recordId, version: pack.manifest.version });
    if (pack.region.reportProblemEmail) {
      void email(pack.region.reportProblemEmail, subject, body);
    } else if (pack.region.reportProblemUrl) {
      const url = `${pack.region.reportProblemUrl}?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      void openExternal(url);
    }
  };

  return (
    <VStack gap="md">
      {!confirmed ? (
        <Card signal="sunflower" treatment="solid">
          <Text bold tone="sunflower">
            {t('source.unconfirmedTitle')}
          </Text>
          <Text variant="label">{t('source.unconfirmedBody')}</Text>
        </Card>
      ) : null}
      <HStack gap="sm">
        <FreshnessRing verifiedAsOf={verifiedAsOf} size={32} />
        <View style={{ flex: 1 }}>
          <Text bold>{t('source.verifiedOn', { date: formatDate(verifiedAsOf, lang, 'long') })}</Text>
          <Text variant="label" tone={f.level === 'stale' ? 'coral' : 'muted'}>
            {t(`source.freshness.${f.level}`, { count: f.days })}
          </Text>
        </View>
      </HStack>
      {sources.map((s, i) => (
        <Card key={`${s.url}-${i}`}>
          <Text variant="subheading">{s.name}</Text>
          <Text variant="label" tone="muted">
            {t(`source.method.${s.method}`)} · {t('source.checkedOn', { date: formatDate(s.checkedOn, lang) })}
          </Text>
          {s.edition ? (
            <Text variant="label" tone="muted">
              {t('source.edition', { edition: s.edition })}
            </Text>
          ) : null}
          {s.note ? <Text variant="label">{s.note}</Text> : null}
          <Tappable
            onPress={() => void openExternal(s.url)}
            accessibilityRole="link"
            accessibilityLabel={t('source.openSource', { name: s.name })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 44 }}>
            <Text variant="label" bold tone="accent" style={{ flexShrink: 1 }} numberOfLines={2}>
              {s.url.replace(/^https:\/\/(www\.)?/, '')}
            </Text>
            <ExternalLink size={16} color={palette.accentInk} />
          </Tappable>
        </Card>
      ))}
      <Text variant="label" tone="muted">
        {t('source.howWeVerify')}
      </Text>
      {canReport ? (
        <Button variant="secondary" icon={Flag} label={t('source.report')} onPress={report} compact />
      ) : null}
      <Text variant="caption" tone="muted">
        {loc(pack.region.name, lang)} · {t('source.packVersion', { version: pack.manifest.version })}
      </Text>
    </VStack>
  );
}
