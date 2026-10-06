import { Search, Sparkles, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { loc } from '@/data/localize';
import { getPack } from '@/data/pack';
import type { Notice } from '@/data/schemas';
import { Badge, Banner, Button, Card, radius, ReadAloud, SourceChip, spacing, Text, useTheme } from '@/design';
import { displayLimit, fplYearRow, type RuleResult } from '@/domain';
import { formatDollars } from '@/i18n/format';
import { openExternal } from '@/services/links';

import { limitParts, ruleIncomeEdges } from './income';

/** Pack notices for a rule's program ("Rules changed recently"). */
export function noticesFor(programKey: string): Notice[] {
  return getPack().notices.filter((n) => (n.appliesTo as readonly string[]).includes(programKey));
}

/**
 * One coverage result (lilac = programs/coverage): tier badge, title, summary, the income limit
 * for this household with the FPL year used, near-limit note, next steps, link buttons named for
 * where they go, and the source chip.
 */
export function ResultCard({
  result,
  householdSize,
  showTier = true,
  overLimit = false,
}: {
  result: RuleResult;
  householdSize: number | null;
  /** The "Standard options" fallback shows the rule without a tier. */
  showTier?: boolean;
  /** The exact income is a little over this rule's limit (see `isJustOverLimit`). */
  overLimit?: boolean;
}) {
  const { t } = useTranslation('onboarding');
  const { palette, lang } = useTheme();
  const { rule } = result;
  const fpl = getPack().fpl;
  const lilac = palette.signals.lilac;

  const title = loc(rule.title, lang);
  const summary = loc(rule.summary, lang);
  const edges = ruleIncomeEdges(rule, fpl, result.fplYear, householdSize);
  const max = result.limitDollars !== null ? displayLimit(result.limitDollars) : edges.max;
  const parts = householdSize === null ? null : limitParts({ min: edges.min, max });
  const fmt = (n: number) => formatDollars(n, lang);
  const limitText =
    parts === null || householdSize === null
      ? null
      : parts.kind === 'under'
        ? t('result.limitUpTo', { count: householdSize, max: fmt(parts.max) })
        : parts.kind === 'range'
          ? t('result.limitRange', { count: householdSize, min: fmt(parts.min), max: fmt(parts.max) })
          : parts.kind === 'over'
            ? t('result.limitOver', { count: householdSize, min: fmt(parts.min) })
            : null;
  const yearRow = limitText ? fplYearRow(fpl, result.fplYear) : undefined;
  const steps = rule.nextSteps.map((s) => loc(s, lang));
  const mayQualify = result.tier === 'mayQualify' && !overLimit;
  const spoken = [title, summary, limitText, ...steps].filter(Boolean).join(' ');

  return (
    <Card
      signal="lilac"
      treatment={mayQualify && showTier ? 'solid' : 'outline'}
      style={styles.card}
      testID={`result-card-${rule.id}`}>
      <View style={styles.topRow}>
        {overLimit ? (
          <Badge signal="sunflower" icon={TriangleAlert} label={t('result.tierOverLimit')} />
        ) : showTier ? (
          <Badge
            signal="lilac"
            icon={mayQualify ? Sparkles : Search}
            label={mayQualify ? t('result.tierMayQualify') : t('result.tierWorthChecking')}
          />
        ) : (
          <View />
        )}
        <ReadAloud text={spoken} label={t('result.readCard')} />
      </View>

      <Text variant="heading">{title}</Text>
      <Text>{summary}</Text>

      {limitText ? (
        <View style={[styles.well, { backgroundColor: palette.surface, borderColor: lilac.solid }]} testID={`result-limit-${rule.id}`}>
          <Text variant="label" tone="muted">
            {t('result.limitLabel')}
          </Text>
          <Text variant="subheading" tabular style={{ color: lilac.ink }}>
            {limitText}
          </Text>
          <Text variant="caption" tone="muted">
            {t('result.fplYear', { year: result.fplYear })}
          </Text>
          {yearRow ? (
            <SourceChip
              sources={yearRow.sources}
              verifiedAsOf={yearRow.verifiedAsOf}
              recordId={`fpl:${result.fplYear}`}
              title={t('income.fplSource', { year: result.fplYear })}
            />
          ) : null}
        </View>
      ) : null}

      {overLimit ? (
        <Banner tone="caution" title={t('result.overLimitTitle')} body={t('result.overLimitBody')} testID={`result-over-${rule.id}`} />
      ) : result.nearLimit ? (
        <Banner tone="caution" title={t('result.nearLimitTitle')} body={t('result.nearLimitBody')} testID={`result-near-${rule.id}`} />
      ) : null}

      {steps.length > 0 ? (
        <View style={styles.steps}>
          <Text variant="label" bold>
            {t('result.nextSteps')}
          </Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: lilac.solid }]}>
                <Text variant="caption" bold style={{ color: palette.surface }} tabular>
                  {i + 1}
                </Text>
              </View>
              <Text variant="label" style={{ flex: 1 }}>
                {s}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {rule.links.length > 0 ? (
        <View style={styles.links}>
          {rule.links.map((link) => (
            <Button
              key={link.id}
              variant="secondary"
              external
              compact
              label={loc(link.label, lang)}
              onPress={() => void openExternal(link.url)}
              testID={`result-link-${link.id}`}
            />
          ))}
        </View>
      ) : null}

      <SourceChip sources={rule.sources} verifiedAsOf={rule.verifiedAsOf} recordId={`rule:${rule.id}`} title={title} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, flexWrap: 'wrap' },
  well: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, gap: spacing.xxs },
  steps: { gap: spacing.xs },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  stepNum: { minWidth: 24, minHeight: 24, paddingHorizontal: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  links: { gap: spacing.xs },
});
