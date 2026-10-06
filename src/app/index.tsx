import { Redirect, type Href } from 'expo-router';

import { useScreener } from '@/state/screener';
import { useSettings } from '@/state/settings';

/** Decides where the app opens: language picker on first launch, the screener step the person left off, or home. */
export default function Index() {
  const language = useSettings((s) => s.language);
  const { completedAt, skipped, lastRoute } = useScreener();
  if (!language) return <Redirect href="/welcome" />;
  if (!completedAt && !skipped) return <Redirect href={(lastRoute ?? '/onboarding/coverage') as Href} />;
  return <Redirect href="/home" />;
}
