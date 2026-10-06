import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card, radius, SourceChip, spacing, Tappable, Text, useTheme } from '@/design';

import type { StepView } from './planSteps';

/**
 * One numbered step on My Plan. The top of the card is one big tap target that opens the
 * place where the step gets done; the source chip sits below it so screen readers can reach
 * both. Buy-now steps use the mint "price you can pay today" treatment.
 */
export function PlanStepCard({ view, index, total }: { view: StepView; index: number; total: number }) {
  const { palette, highContrast } = useTheme();
  const { t } = useTranslation('plan');
  const s = palette.signals[view.signal];
  const Icon = view.icon;
  const isPrice = view.price !== null;
  const n = index + 1;

  const a11y = [
    t('steps.a11yStep', { n, total }),
    view.kindLabel,
    view.title,
    view.price ? `${view.price.value}, ${view.price.packageText}, ${view.price.note}` : null,
    view.body,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Card padded={false} signal={isPrice ? 'mint' : undefined} treatment={isPrice ? 'solid' : 'plain'} testID={view.testID}>
      <Tappable
        onPress={() => router.push(view.href)}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint={view.cta}
        style={styles.main}>
        <View style={styles.row}>
          <View
            style={[
              styles.number,
              { backgroundColor: isPrice ? palette.surface : s.tint, borderColor: s.solid },
            ]}>
            <Text variant="subheading" tabular style={{ color: s.ink }}>
              {n}
            </Text>
          </View>
          <View style={styles.content}>
            <View style={styles.kind}>
              <Icon size={16} color={s.ink} />
              <Text variant="caption" bold style={{ color: s.ink, flexShrink: 1 }}>
                {view.kindLabel}
              </Text>
            </View>
            <Text variant="subheading">{view.title}</Text>
            {view.price ? (
              <View style={{ gap: 2 }}>
                <Text variant="priceSmall" style={{ color: s.ink }}>
                  {view.price.value}
                </Text>
                <Text variant="label">{view.price.packageText}</Text>
                <Text variant="label" tone="muted">
                  {view.price.note}
                </Text>
              </View>
            ) : null}
            {view.body ? (
              <Text variant="label" tone="muted">
                {view.body}
              </Text>
            ) : null}
            <View
              style={[
                styles.cta,
                {
                  backgroundColor: isPrice ? palette.surface : palette.surfaceSunken,
                  borderColor: highContrast ? palette.border : isPrice ? s.solid : palette.border,
                },
              ]}>
              <Text variant="label" bold tone="accent" style={{ flexShrink: 1 }}>
                {view.cta}
              </Text>
              <ChevronRight size={18} color={palette.accentInk} />
            </View>
          </View>
        </View>
      </Tappable>
      {view.source ? (
        <View style={styles.source}>
          <SourceChip
            sources={view.source.sources}
            verifiedAsOf={view.source.verifiedAsOf}
            recordId={view.source.recordId}
            title={view.source.title}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  main: { padding: spacing.md, borderRadius: radius.md },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  number: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: spacing.xxs },
  kind: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, flexWrap: 'wrap' },
  cta: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  source: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, marginTop: -spacing.xs },
});
