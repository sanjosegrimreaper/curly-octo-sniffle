import { useLocalSearchParams } from 'expo-router';

import { DraftBanner } from '@/components/DraftBanner';
import { HelpPayingTab } from '@/components/programs/HelpPayingTab';
import { Screen } from '@/design';

/**
 * Dev-only preview of the Help paying tab (used for screenshots while the Results screen is
 * built elsewhere). /dev/programs-preview?drug=apixaban
 */
export default function ProgramsPreview() {
  const { drug } = useLocalSearchParams<{ drug?: string }>();
  return (
    <Screen back testID="programs-preview">
      <DraftBanner />
      <HelpPayingTab medicationId={drug ?? 'apixaban'} />
    </Screen>
  );
}
