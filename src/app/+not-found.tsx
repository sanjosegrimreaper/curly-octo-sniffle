import { router, type Href } from 'expo-router';
import { Home, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState, Screen, VStack } from '@/design';

/** Friendly not-found: never a dead end. */
export default function NotFoundScreen() {
  const { t } = useTranslation('plan');
  return (
    <Screen testID="not-found-screen">
      <EmptyState
        illustration="magnifier"
        title={t('notFound.title')}
        body={t('notFound.body')}
        action={
          <VStack gap="xs">
            <Button icon={Home} label={t('notFound.home')} onPress={() => router.replace('/' as Href)} testID="not-found-home" />
            <Button
              variant="secondary"
              icon={Search}
              label={t('notFound.search')}
              onPress={() => router.replace('/find' as Href)}
              testID="not-found-search"
            />
          </VStack>
        }
      />
    </Screen>
  );
}
