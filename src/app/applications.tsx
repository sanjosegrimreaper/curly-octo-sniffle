import { router, type Href } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';

import { ApplicationCard } from '@/components/programs/ApplicationCard';
import { findProgram } from '@/components/programs/helpers';
import { Button, EmptyState, Screen, Text } from '@/design';
import { useApplications } from '@/state/applications';

/** Application tracker: every program the person is tracking, in the order they added them. */
export default function ApplicationsScreen() {
  const { t } = useTranslation('programs');
  const byProgram = useApplications((s) => s.byProgram);
  const apps = Object.values(byProgram);
  const count = apps.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(count === 0 ? t('tracker.emptyTitle') : t('tracker.count', { count }));
  }, [count, t]);

  return (
    <Screen back title={t('tracker.title')} testID="applications">
      <Text tone="muted">{count === 0 ? t('tracker.intro') : t('tracker.count', { count })}</Text>
      {count === 0 ? (
        <EmptyState
          illustration="folder"
          title={t('tracker.emptyTitle')}
          body={t('tracker.emptyBody')}
          testID="applications-empty"
          action={
            <Button icon={Search} label={t('tracker.find')} onPress={() => router.push('/find' as Href)} testID="applications-find" />
          }
        />
      ) : (
        apps.map((a, i) => (
          <ApplicationCard key={a.programId} application={a} program={findProgram(a.programId)} index={i} />
        ))
      )}
    </Screen>
  );
}
