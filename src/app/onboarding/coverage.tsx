import { router } from 'expo-router';
import { ShieldCheck, ShieldQuestionMark, ShieldX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ChoiceCard, ChoiceGroup } from '@/components/onboarding/ChoiceCard';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { Button } from '@/design';
import { useScreener, type CoverageAnswer } from '@/state/screener';

const ROUTE = ROUTES.coverage;

/** "Do you have health insurance right now?" Yes → what kind; No / Not sure → where you live. */
export default function CoverageScreen() {
  const { t } = useTranslation('onboarding');
  const coverage = useScreener((s) => s.coverage);
  const update = useScreener((s) => s.update);

  const choose = (value: CoverageAnswer) =>
    update(value === 'yes' ? { coverage: value } : { coverage: value, coverageType: null });

  const next = () => {
    if (!coverage) return;
    router.push(href(coverage === 'yes' ? ROUTES.coverageType : ROUTES.county));
  };

  const options = [
    { value: 'yes', title: t('coverage.yes'), subtitle: t('coverage.yesSub'), icon: ShieldCheck },
    { value: 'no', title: t('coverage.no'), subtitle: t('coverage.noSub'), icon: ShieldX },
    { value: 'unsure', title: t('coverage.unsure'), subtitle: t('coverage.unsureSub'), icon: ShieldQuestionMark },
  ] as const;

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-coverage"
      title={t('coverage.title')}
      subtitle={t('coverage.body')}
      footer={
        <Button
          label={t('next')}
          hint={coverage ? undefined : t('chooseOne')}
          onPress={next}
          disabled={!coverage}
          testID="coverage-next"
        />
      }>
      <ChoiceGroup label={t('coverage.groupLabel')}>
        {options.map((o, i) => (
          <ChoiceCard
            key={o.value}
            index={i}
            title={o.title}
            subtitle={o.subtitle}
            icon={o.icon}
            signal="lilac"
            selected={coverage === o.value}
            onPress={() => choose(o.value)}
            testID={`coverage-${o.value}`}
          />
        ))}
      </ChoiceGroup>
    </ScreenerScreen>
  );
}
