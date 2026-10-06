import { router } from 'expo-router';
import { Briefcase, CircleQuestionMark, HeartHandshake, Landmark } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ChoiceCard, ChoiceGroup } from '@/components/onboarding/ChoiceCard';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { Button } from '@/design';
import { useScreener, type CoverageType } from '@/state/screener';

const ROUTE = ROUTES.coverageType;

/**
 * "What kind?" Job or Covered California / Other → insurance checklist; Medi-Cal → how Medi-Cal
 * works at the pharmacy; Medicare → the Medicare panel (the screener ends there).
 */
export default function CoverageTypeScreen() {
  const { t } = useTranslation('onboarding');
  const coverageType = useScreener((s) => s.coverageType);
  const update = useScreener((s) => s.update);

  const next = () => {
    switch (coverageType) {
      case 'private':
      case 'other':
        router.push(href(ROUTES.checklist));
        return;
      case 'medi-cal':
        router.push(href(ROUTES.mediCal));
        return;
      case 'medicare':
        update({ completedAt: new Date().toISOString() });
        router.push(href(ROUTES.medicareFromOnboarding));
        return;
      default:
        return;
    }
  };

  const options: { value: CoverageType; title: string; subtitle?: string; icon: typeof Briefcase }[] = [
    { value: 'private', title: t('coverageType.private'), subtitle: t('coverageType.privateSub'), icon: Briefcase },
    { value: 'medi-cal', title: t('coverageType.mediCal'), icon: HeartHandshake },
    { value: 'medicare', title: t('coverageType.medicare'), icon: Landmark },
    { value: 'other', title: t('coverageType.other'), subtitle: t('coverageType.otherSub'), icon: CircleQuestionMark },
  ];

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-coverage-type"
      title={t('coverageType.title')}
      subtitle={t('coverageType.body')}
      footer={
        <Button
          label={t('next')}
          hint={coverageType ? undefined : t('chooseOne')}
          onPress={next}
          disabled={!coverageType}
          testID="coverage-type-next"
        />
      }>
      <ChoiceGroup label={t('coverageType.groupLabel')}>
        {options.map((o, i) => (
          <ChoiceCard
            key={o.value}
            index={i}
            title={o.title}
            subtitle={o.subtitle}
            icon={o.icon}
            signal="lilac"
            selected={coverageType === o.value}
            onPress={() => update({ coverageType: o.value })}
            testID={`coverage-type-${o.value}`}
          />
        ))}
      </ChoiceGroup>
    </ScreenerScreen>
  );
}
