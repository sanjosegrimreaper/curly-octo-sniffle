import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { HelpPayingTab } from '@/components/programs/HelpPayingTab';
import { DrugNotFound } from '@/components/results/DrugNotFound';
import { selectionText } from '@/components/results/labels';
import { resolveSelection, type RawSelectionParams } from '@/components/results/params';
import { PricesTab } from '@/components/results/PricesTab';
import { ResultsHeader } from '@/components/results/ResultsHeader';
import { SaveStar } from '@/components/results/SaveStar';
import { getPack } from '@/data/pack';
import { motion, Screen, Segmented, spacing, useTheme } from '@/design';
import { usePriceSummary } from '@/hooks/usePrices';

type Tab = 'prices' | 'help';

/** Results: header + Prices | Help paying. Params are validated; a bad link never crashes. */
export default function ResultsScreen() {
  const { t } = useTranslation('results');
  const { lang, reduceMotion } = useTheme();
  const params = useLocalSearchParams<RawSelectionParams & Record<string, string | string[]>>();
  const { id, strength: strengthParam, qty, perDay } = params;

  const resolved = useMemo(
    () => resolveSelection(getPack(), { id, strength: strengthParam, qty, perDay }),
    [id, strengthParam, qty, perDay],
  );
  const selection = resolved.status === 'ok' ? resolved.selection : null;
  const summary = usePriceSummary(selection);
  const [tab, setTab] = useState<Tab>('prices');

  const selectionLabel = resolved.status === 'ok' ? selectionText(t, resolved.strength, resolved.selection.quantity, lang) : '';

  // Tell screen readers when the prices change for a new strength or amount (not on first load).
  const lastLabel = useRef(selectionLabel);
  useEffect(() => {
    if (lastLabel.current === selectionLabel) return;
    lastLabel.current = selectionLabel;
    AccessibilityInfo.announceForAccessibility(t('header.updated', { selection: selectionLabel }));
  }, [selectionLabel, t]);

  if (resolved.status !== 'ok' || !selection || !summary) {
    return (
      <Screen back testID="results-screen">
        <DrugNotFound />
      </Screen>
    );
  }

  const onTab = (next: Tab) => {
    setTab(next);
    AccessibilityInfo.announceForAccessibility(t('tabs.announce', { tab: next === 'prices' ? t('tabs.prices') : t('tabs.help') }));
  };

  return (
    <Screen back right={<SaveStar selection={selection} summary={summary} />} testID="results-screen">
      <ResultsHeader medication={resolved.medication} selection={selection} selectionLabel={selectionLabel} />
      <Segmented<Tab>
        accessibilityLabel={t('tabs.label')}
        value={tab}
        onChange={onTab}
        options={[
          { value: 'prices', label: t('tabs.prices'), testID: 'tab-prices' },
          { value: 'help', label: t('tabs.help'), testID: 'tab-help-paying' },
        ]}
      />
      <View style={{ marginTop: spacing.xs }}>
        {tab === 'prices' ? (
          <PricesTab
            summary={summary}
            selectionLabel={selectionLabel}
            perDay={selection.perDay ?? null}
            onSwitchQuantity={(q) => router.setParams({ qty: String(q) })}
          />
        ) : (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)} testID="help-paying-tab">
            <HelpPayingTab medicationId={resolved.medication.id} />
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}
