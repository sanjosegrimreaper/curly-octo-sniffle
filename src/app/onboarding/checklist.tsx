import { IdCard, ListChecks, PiggyBank, Receipt, Store, Wallet, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AmountField, parseAmount } from '@/components/onboarding/AmountField';
import { ChecklistItem } from '@/components/onboarding/ChecklistItem';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { Banner, Button, Card, spacing, Text, useTheme } from '@/design';
import { roundCents } from '@/domain';
import { formatMoney } from '@/i18n/format';
import { useScreener } from '@/state/screener';
import { startFresh } from '@/navigation';

const ROUTE = ROUTES.checklist;

type ItemId = 'card' | 'formulary' | 'deductible' | 'copay' | 'pharmacy';
const ITEMS: { id: ItemId; icon: LucideIcon; glossary?: string }[] = [
  { id: 'card', icon: IdCard },
  { id: 'formulary', icon: ListChecks, glossary: 'formulary' },
  { id: 'deductible', icon: PiggyBank, glossary: 'deductible' },
  { id: 'copay', icon: Receipt, glossary: 'copay' },
  { id: 'pharmacy', icon: Store },
];

/** Shows a stored copay (cents) as the person would type it: "25" or "12.50". */
function copayText(cents: number | null) {
  if (cents === null) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** For people with a job / Covered California / other plan: what to have ready, plus the optional Copay Check. */
export default function ChecklistScreen() {
  const { t } = useTranslation('onboarding');
  const { palette, lang } = useTheme();
  const checklist = useScreener((s) => s.checklist);
  const toggle = useScreener((s) => s.toggleChecklist);
  const copayCents = useScreener((s) => s.copayCents);
  const update = useScreener((s) => s.update);
  const [text, setText] = useState(() => copayText(copayCents));

  const done = ITEMS.filter((i) => checklist[i.id]).length;
  const parsed = parseAmount(text);
  const invalid = text.trim() !== '' && parsed === null;

  const onCopay = (value: string) => {
    setText(value);
    if (value.trim() === '') update({ copayCents: null });
    else {
      const v = parseAmount(value);
      if (v !== null) update({ copayCents: roundCents(v * 100) });
    }
  };

  const compare = () => {
    update({ completedAt: new Date().toISOString() });
    startFresh(href(ROUTES.find));
  };

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-checklist"
      title={t('checklist.title')}
      subtitle={t('checklist.body')}
      footer={<Button label={t('checklist.compare')} onPress={compare} testID="checklist-compare" />}>
      <Text
        variant="label"
        bold
        tone={done === ITEMS.length ? 'mint' : 'muted'}
        accessibilityLiveRegion="polite"
        testID="checklist-progress">
        {t('checklist.progress', { count: done, total: ITEMS.length })}
      </Text>
      <View style={{ gap: spacing.sm }}>
        {ITEMS.map((item) => (
          <ChecklistItem
            key={item.id}
            label={t(`checklist.items.${item.id}`)}
            icon={item.icon}
            checked={!!checklist[item.id]}
            onToggle={() => toggle(item.id)}
            glossaryTermId={item.glossary}
            testID={`checklist-${item.id}`}
          />
        ))}
      </View>

      <Card style={{ gap: spacing.sm, marginTop: spacing.sm }} testID="copay-check">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: palette.signals.mint.tint,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Wallet size={22} color={palette.signals.mint.ink} />
          </View>
          <Text variant="heading" style={{ flex: 1 }}>
            {t('checklist.copayTitle')}
          </Text>
        </View>
        <Text>{t('checklist.copayBody')}</Text>
        <AmountField
          label={t('checklist.copayLabel')}
          prefix="$"
          value={text}
          onChangeText={onCopay}
          placeholder={t('checklist.copayPlaceholder')}
          error={invalid ? t('checklist.copayInvalid') : null}
          hint={
            copayCents !== null && !invalid
              ? t('checklist.copaySaved', { amount: formatMoney(copayCents, lang) })
              : undefined
          }
          testID="copay-input"
        />
        {copayCents !== null ? (
          <Button
            variant="ghost"
            compact
            label={t('checklist.copayClear')}
            onPress={() => onCopay('')}
            style={{ alignSelf: 'flex-start' }}
            testID="copay-clear"
          />
        ) : null}
        <Banner tone="info" title={t('checklist.copayNoteTitle')} body={t('checklist.copayNote')} />
      </Card>
    </ScreenerScreen>
  );
}
