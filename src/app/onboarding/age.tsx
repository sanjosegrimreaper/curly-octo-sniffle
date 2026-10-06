import { router } from 'expo-router';
import { UserCheck, UserX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ChoiceCard, ChoiceGroup } from '@/components/onboarding/ChoiceCard';
import { ScreenerScreen } from '@/components/onboarding/ScreenerScreen';
import { href, ROUTES } from '@/components/onboarding/steps';
import { Button } from '@/design';
import { useScreener } from '@/state/screener';

const ROUTE = ROUTES.age;

/** Optional: "Is anyone in your household 65 or older?" — used only to show Medicare information. */
export default function AgeScreen() {
  const { t } = useTranslation('onboarding');
  const age65 = useScreener((s) => s.age65);
  const update = useScreener((s) => s.update);
  const answered = age65 === 'yes' || age65 === 'no';
  const goNext = () => router.push(href(ROUTES.household));

  const options = [
    { value: 'yes', title: t('age.yes'), subtitle: t('age.yesSub'), icon: UserCheck },
    { value: 'no', title: t('age.no'), subtitle: t('age.noSub'), icon: UserX },
  ] as const;

  return (
    <ScreenerScreen
      route={ROUTE}
      testID="screen-age"
      title={t('age.title')}
      subtitle={t('age.body')}
      footer={
        <>
          <Button
            label={t('next')}
            hint={answered ? undefined : t('chooseOne')}
            onPress={goNext}
            disabled={!answered}
            testID="age-next"
          />
          <Button
            variant="ghost"
            label={t('age.skip')}
            onPress={() => {
              update({ age65: 'skip' });
              goNext();
            }}
            testID="age-skip"
          />
        </>
      }>
      <ChoiceGroup label={t('age.groupLabel')}>
        {options.map((o, i) => (
          <ChoiceCard
            key={o.value}
            index={i}
            title={o.title}
            subtitle={o.subtitle}
            icon={o.icon}
            signal="tangerine"
            selected={age65 === o.value}
            onPress={() => update({ age65: o.value })}
            testID={`age-${o.value}`}
          />
        ))}
      </ChoiceGroup>
    </ScreenerScreen>
  );
}
