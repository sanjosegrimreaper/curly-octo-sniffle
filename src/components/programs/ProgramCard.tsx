import { router, type Href } from 'expo-router';
import {
  Ban,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  ExternalLink,
  HandHeart,
  Info,
  Phone,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { getPack } from '@/data/pack';
import { loc } from '@/data/localize';
import {
  Badge,
  Button,
  Card,
  GlossaryChip,
  HStack,
  minTap,
  motion,
  radius,
  ReadAloud,
  SourceChip,
  spacing,
  Tappable,
  Text,
  useTheme,
  VStack,
  type SignalName,
} from '@/design';
import { displayLimit, guidelineFor, yearOrLatest, type Fit, type IncomeFit, type ProgramMatch } from '@/domain';
import { useProfile } from '@/hooks/useProfile';
import { formatDollars, formatPercent } from '@/i18n/format';
import { call, openExternal } from '@/services/links';

import { coveredNames, formatPhone, isPdf, phoneForSpeech, siteOf } from './helpers';
import { useTrack } from './useTrack';

export type ProgramCardProps = {
  match: ProgramMatch;
  /** The medicine the person is looking at (passed on to the call coach). */
  medicationId?: string;
  /** compact = list card (Help paying tab); expanded = program detail (adds the math, read aloud). */
  variant?: 'compact' | 'expanded';
  /** Position in the list, for the staggered entrance. */
  index?: number;
  /** Call coach + Track buttons (the detail screen places its own). */
  showActions?: boolean;
  /** The detail screen shows the name as its title. */
  hideName?: boolean;
};

const COVERAGE_FIT: Record<Fit, { signal: SignalName; icon: LucideIcon }> = {
  yes: { signal: 'mint', icon: CircleCheck },
  maybe: { signal: 'sunflower', icon: CircleHelp },
  no: { signal: 'coral', icon: CircleX },
};

const INCOME_FIT: Record<Exclude<IncomeFit, 'unpublished'>, { signal: SignalName; icon: LucideIcon }> = {
  under: { signal: 'mint', icon: CircleCheck },
  overlap: { signal: 'sunflower', icon: CircleHelp },
  over: { signal: 'coral', icon: CircleAlert },
  unknown: { signal: 'sky', icon: Info },
};

const STAGGER_MS = 40;

/** One assistance program, matched against the person's answers. */
export function ProgramCard({
  match,
  medicationId,
  variant = 'compact',
  index = 0,
  showActions = true,
  hideName = false,
}: ProgramCardProps) {
  const { t } = useTranslation('programs');
  const { palette, lang, reduceMotion } = useTheme();
  const profile = useProfile();
  const { program, capDollars, insurance, income, group } = match;
  const { tracked, ensureTracked } = useTrack(program.id);
  const expanded = variant === 'expanded';
  const closed = group === 'closed';

  const description = loc(program.description, lang);
  const covers = coveredNames(program, lang);
  const ruleText = loc(program.insuranceRuleText, lang);
  const cutoffNote = loc(program.cutoffNote, lang);
  const drugQuery = medicationId ? `?drug=${encodeURIComponent(medicationId)}` : '';

  const onTrack = () => {
    ensureTracked();
    router.push('/applications' as Href);
  };

  const fit = COVERAGE_FIT[insurance];

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(index * STAGGER_MS).duration(motion.slow)}
      testID={`program-card-${program.id}`}>
      <Card signal={group === 'likely' ? 'lilac' : undefined} treatment={group === 'likely' ? 'outline' : 'plain'}>
        <VStack gap="sm">
          {/* label */}
          <HStack gap="xs" style={{ justifyContent: 'space-between' }}>
            <HStack gap="xs">
              <View style={[styles.kindIcon, { backgroundColor: palette.signals.lilac.tint }]}>
                <HandHeart size={16} color={palette.signals.lilac.ink} />
              </View>
              <Text variant="caption" bold tone="lilac">
                {t(`kind.${program.kind}`)}
              </Text>
            </HStack>
            {closed ? <Badge signal="coral" icon={Ban} label={t('card.closed')} /> : null}
            {!closed && tracked ? <Badge signal="mint" icon={ClipboardCheck} label={t('card.trackingBadge')} /> : null}
          </HStack>

          {/* value */}
          <VStack gap="xxs">
            {hideName ? null : <Text variant="heading">{program.name}</Text>}
            <Text variant="label" tone="muted">
              {t('card.from', { sponsor: program.sponsor })}
            </Text>
          </VStack>

          <Text>{description}</Text>
          {expanded ? <ReadAloud text={description} label={t('card.listenLabel')} /> : null}

          {covers.length > 0 ? (
            <Text variant="label" bold>
              {t('card.covers', { names: covers.join(', ') })}
            </Text>
          ) : null}

          {closed ? (
            <Text variant="label" tone="coral">
              {t('card.closedNote')}
            </Text>
          ) : null}

          {/* package: coverage + income fit */}
          <View style={[styles.well, { backgroundColor: palette.surfaceSunken, borderColor: palette.border }]}>
            <VStack gap="xs">
              <Text variant="caption" tone="muted" bold>
                {t('card.coverage')}
              </Text>
              <Badge signal={fit.signal} icon={fit.icon} label={t(`fit.coverage.${insurance}`)} />
              <Text variant="label" tone="muted">
                {ruleText}
              </Text>
            </VStack>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <IncomeBlock
              match={match}
              householdSize={profile.householdSize}
              expanded={expanded}
              capDollars={capDollars}
              income={income}
            />
          </View>

          {/* note */}
          {cutoffNote ? (
            <HStack gap="xs" align="flex-start" wrap={false}>
              <Info size={18} color={palette.signals.sky.ink} style={{ marginTop: 2 }} />
              <Text variant="label" style={{ flex: 1 }}>
                {cutoffNote}
              </Text>
            </HStack>
          ) : null}

          {!expanded && program.documents.length > 0 ? <DocsPreview documents={program.documents.map((d) => loc(d, lang))} /> : null}

          <PhoneRow name={program.name} phone={program.phone} />

          {program.applicationUrl ? (
            <LinkRow
              external
              label={
                isPdf(program.applicationUrl)
                  ? t('card.openForm', { site: siteOf(program.applicationUrl) })
                  : t('card.openApplication', { site: siteOf(program.applicationUrl) })
              }
              onPress={() => void openExternal(program.applicationUrl ?? '')}
              testID={`program-apply-${program.id}`}
            />
          ) : (
            <Text variant="label" tone="muted">
              {t('card.noApplication')}
            </Text>
          )}

          {showActions ? (
            <VStack gap="xs">
              <Button
                variant="secondary"
                compact
                icon={PhoneCall}
                label={t('card.callCoach')}
                hint={t('card.callCoachHint')}
                onPress={() => router.push(`/call-coach/${program.id}${drugQuery}` as Href)}
                testID={`program-coach-${program.id}`}
              />
              <Button
                variant="secondary"
                compact
                icon={tracked ? ClipboardCheck : ClipboardList}
                label={tracked ? t('card.tracking') : t('card.track')}
                onPress={onTrack}
                testID={`program-track-${program.id}`}
              />
            </VStack>
          ) : null}

          {!expanded ? (
            <LinkRow
              label={t('card.details')}
              a11yLabel={t('card.detailsA11y', { name: program.name })}
              onPress={() => router.push(`/program/${program.id}${drugQuery}` as Href)}
              testID={`program-details-${program.id}`}
            />
          ) : null}

          {/* source chip */}
          <SourceChip
            sources={program.sources}
            verifiedAsOf={program.verifiedAsOf}
            recordId={`program:${program.id}`}
            title={program.name}
          />
        </VStack>
      </Card>
    </Animated.View>
  );
}

function IncomeBlock({
  match,
  householdSize,
  expanded,
  capDollars,
  income,
}: {
  match: ProgramMatch;
  householdSize: number | null;
  expanded: boolean;
  capDollars: number | null;
  income: IncomeFit;
}) {
  const { t } = useTranslation('programs');
  const { palette, lang } = useTheme();
  const { program } = match;

  if (program.fplMax === null) {
    return (
      <VStack gap="xxs">
        <HStack gap="xs">
          <Text variant="caption" tone="muted" bold>
            {t('card.incomeLimit')}
          </Text>
          <GlossaryChip termId="fpl" />
        </HStack>
        <Text variant="subheading" testID={`program-limit-${program.id}`}>
          {t('card.limitNotPublished')}
        </Text>
      </VStack>
    );
  }

  const fpl = getPack().fpl;
  const year = yearOrLatest(fpl, program.fplYear);
  const pct = formatPercent(program.fplMax, lang);
  const fitMeta = income === 'unpublished' ? null : INCOME_FIT[income];
  const guideline = householdSize !== null ? guidelineFor(fpl, year, householdSize) : null;

  return (
    <VStack gap="xxs">
      <HStack gap="xs">
        <Text variant="caption" tone="muted" bold>
          {t('card.incomeLimit')}
        </Text>
        <GlossaryChip termId="fpl" />
      </HStack>
      {capDollars !== null && householdSize !== null ? (
        <>
          <Text variant="priceSmall" testID={`program-limit-${program.id}`}>
            {t('card.perYear', { amount: formatDollars(displayLimit(capDollars), lang) })}
          </Text>
          <Text variant="label" tone="muted">
            {t('card.limitPackage', { pct, count: householdSize, year })}
          </Text>
          {expanded && guideline !== null ? (
            <Text variant="caption" tone="muted" tabular>
              {t('card.math', {
                pct,
                guideline: formatDollars(guideline, lang),
                year,
                count: householdSize,
                amount: formatDollars(displayLimit(capDollars), lang),
              })}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text variant="subheading" testID={`program-limit-${program.id}`}>
            {t('card.limitNoHousehold', { pct, year })}
          </Text>
          <Text variant="label" tone="muted">
            {t('card.limitNoHouseholdNote')}
          </Text>
        </>
      )}
      {fitMeta ? (
        <HStack gap="xs" wrap={false} align="flex-start" style={{ marginTop: spacing.xxs }}>
          <fitMeta.icon size={18} color={palette.signals[fitMeta.signal].ink} style={{ marginTop: 2 }} />
          <Text variant="label" bold tone={fitMeta.signal} style={{ flex: 1 }} testID={`program-income-fit-${program.id}`}>
            {t(`fit.income.${income as Exclude<IncomeFit, 'unpublished'>}`)}
          </Text>
        </HStack>
      ) : null}
    </VStack>
  );
}

function DocsPreview({ documents }: { documents: string[] }) {
  const { t } = useTranslation('programs');
  const { palette } = useTheme();
  const shown = documents.slice(0, 2);
  const more = documents.length - shown.length;
  return (
    <VStack gap="xxs">
      <Text variant="caption" tone="muted" bold>
        {t('card.documents')}
      </Text>
      {shown.map((d) => (
        <HStack key={d} gap="xs" wrap={false} align="flex-start">
          <View style={[styles.bullet, { backgroundColor: palette.signals.lilac.solid }]} />
          <Text variant="label" style={{ flex: 1 }}>
            {d}
          </Text>
        </HStack>
      ))}
      {more > 0 ? (
        <Text variant="label" tone="muted" bold>
          {t('card.moreDocs', { count: more })}
        </Text>
      ) : null}
    </VStack>
  );
}

/** A left-aligned text link with a chevron (in-app) or a link-out icon (website). */
function LinkRow({
  label,
  a11yLabel,
  onPress,
  external,
  testID,
}: {
  label: string;
  a11yLabel?: string;
  onPress: () => void;
  external?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation('common');
  const { palette } = useTheme();
  const Icon = external ? ExternalLink : ChevronRight;
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityHint={external ? t('opensWebsite') : undefined}
      style={styles.details}
      testID={testID}>
      <Text variant="label" bold tone="accent" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Icon size={18} color={palette.accentInk} />
    </Tappable>
  );
}

/** Tap-to-call row. Shows "Phone number not listed" when the pack has none (never a guess). */
export function PhoneRow({ name, phone }: { name: string; phone: string | null }) {
  const { t } = useTranslation('programs');
  const { palette } = useTheme();
  if (!phone) {
    return (
      <HStack gap="xs">
        <Phone size={18} color={palette.textMuted} />
        <Text variant="label" tone="muted">
          {t('card.noPhone')}
        </Text>
      </HStack>
    );
  }
  const pretty = formatPhone(phone);
  return (
    <Tappable
      onPress={() => void call(phone)}
      accessibilityRole="link"
      accessibilityLabel={t('card.callA11y', { name, digits: phoneForSpeech(phone) })}
      accessibilityHint={t('card.callHint')}
      style={[styles.phone, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.phoneIcon, { backgroundColor: palette.signals.mint.tint }]}>
        <Phone size={20} color={palette.signals.mint.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="subheading" tabular>
          {pretty}
        </Text>
        <Text variant="caption" tone="muted">
          {t('card.tapToCall')}
        </Text>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  kindIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  well: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, gap: spacing.sm },
  divider: { height: 1, width: '100%' },
  bullet: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  details: {
    minHeight: minTap,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingRight: spacing.xs,
  },
  phone: {
    minHeight: minTap + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  phoneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
