import { router } from 'expo-router';
import { Map, MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ChoiceCard, ChoiceGroup } from '@/components/onboarding/ChoiceCard';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { loc } from '@/data/localize';
import { getPack } from '@/data/pack';
import { Banner, Button, motion, SourceChip, spacing, Text, useTheme } from '@/design';
import { useScreener } from '@/state/screener';

const ROUTE = ROUTES.county;
const OTHER = 'other';

/** "Where do you live?" — the region pack's counties, or "Somewhere else". */
export default function CountyScreen() {
  const { t } = useTranslation('onboarding');
  const { lang, reduceMotion } = useTheme();
  const county = useScreener((s) => s.county);
  const update = useScreener((s) => s.update);
  const region = getPack().region;
  const districtsNote = region.districtsNote ? loc(region.districtsNote, lang) : null;

  const options = [
    ...region.counties.map((c) => ({ id: c.id, title: c.name, subtitle: undefined as string | undefined, icon: MapPin })),
    { id: OTHER, title: t('county.other'), subtitle: t('county.otherSub'), icon: Map },
  ];

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-county"
      title={t('county.title')}
      subtitle={t('county.body')}
      footer={
        <Button
          label={t('next')}
          hint={county ? undefined : t('chooseOne')}
          onPress={() => router.push(href(ROUTES.age))}
          disabled={!county}
          testID="county-next"
        />
      }>
      <ChoiceGroup label={t('county.groupLabel')}>
        {options.map((o, i) => (
          <ChoiceCard
            key={o.id}
            index={i}
            title={o.title}
            subtitle={o.subtitle}
            icon={o.icon}
            selected={county === o.id}
            onPress={() => update({ county: o.id })}
            testID={`county-${o.id}`}
          />
        ))}
      </ChoiceGroup>

      {county === OTHER ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}>
          <Banner tone="info" title={t('county.otherNote', { region: loc(region.name, lang) })} />
        </Animated.View>
      ) : null}

      {districtsNote ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <Text variant="caption" tone="muted">
            {districtsNote}
          </Text>
          <SourceChip sources={region.sources} verifiedAsOf={region.verifiedAsOf} recordId={`region:${region.id}`} title={districtsNote} />
        </View>
      ) : null}
    </ScreenerScreen>
  );
}
