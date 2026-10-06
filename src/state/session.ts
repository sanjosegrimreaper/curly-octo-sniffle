import { useApplications } from './applications';
import { useMedicines } from './medicines';
import { useScreener } from './screener';
import { cancelAllReminders } from '@/services/notifications';
import { stopSpeaking } from '@/services/speech';

import { clearAllPersonalData } from './storage';

/** "Start over" / "New client" / "Clear my data". */
export async function wipePersonalData() {
  useScreener.getState().reset();
  useMedicines.getState().reset();
  useApplications.getState().reset();
  stopSpeaking();
  await Promise.all([clearAllPersonalData(), cancelAllReminders()]);
}
