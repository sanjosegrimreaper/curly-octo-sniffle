import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { useMedicines } from '@/state/medicines';
import { wipePersonalData } from '@/state/session';

/**
 * "Start over", "Clear my data" and "New client": clears answers, saved medicines, recent
 * searches and applications (via `wipePersonalData`), and cancels every scheduled reminder,
 * so nothing about the person is left on the phone.
 */
export async function wipeEverything() {
  if (Platform.OS !== 'web') {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // nothing scheduled or notifications unavailable
    }
  }
  await wipePersonalData();
  // `wipePersonalData` resets the medicines store (saved + recents); make the recents part explicit.
  useMedicines.setState({ recents: [] });
}
