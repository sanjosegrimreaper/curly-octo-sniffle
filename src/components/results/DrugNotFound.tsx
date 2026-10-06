import { router, type Href } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState } from '@/design';

/** Friendly not-found for a bad or old link to a medicine. Never a dead end. */
export function DrugNotFound() {
  const { t } = useTranslation('results');
  return (
    <EmptyState
      testID="drug-not-found"
      illustration="magnifier"
      title={t('notFound.title')}
      body={t('notFound.body')}
      action={
        <Button
          icon={Search}
          label={t('notFound.search')}
          onPress={() => router.replace('/find' as Href)}
          testID="search-again"
        />
      }
    />
  );
}
