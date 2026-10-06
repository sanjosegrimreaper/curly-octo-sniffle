import { Platform } from 'react-native';

import { i18next } from '@/i18n';
import { cancelReminder, scheduleRefillReminder } from '@/services/notifications';
import { useMedicines, type SavedMedicine } from '@/state/medicines';
import { useSettings } from '@/state/settings';
import { useUi } from '@/state/ui';

/**
 * Remembers how long one fill lasts, as "how many a day" (`perDay` = quantity ÷ days), so
 * the budget and refill reminders use the person's own answer.
 *
 * The medicines store has no `setPerDay` action yet (requested from the lead), so this
 * writes through the store's public `setState`, which the persist middleware saves as usual.
 */
export function setFillDays(key: string, days: number | null) {
  useMedicines.setState((s) => ({
    saved: s.saved.map((m) =>
      m.key === key ? { ...m, perDay: days !== null && days > 0 ? m.quantity / days : null } : m,
    ),
  }));
}

/** Schedules a repeating local reminder; private wording unless the person turned that off. */
export async function turnOnRefill(m: SavedMedicine, everyDays: number, name: string): Promise<boolean> {
  const t = i18next.getFixedT(null, 'medicines');
  const toast = useUi.getState().showToast;
  if (Platform.OS === 'web') {
    toast(t('refill.web'), 'caution');
    return false;
  }
  const isPrivate = useSettings.getState().privateNotifications;
  const title = t('refill.title');
  const body = isPrivate ? t('refill.privateBody') : t('refill.namedBody', { name });
  if (m.refill) await cancelReminder(m.refill.notificationId);
  const id = await scheduleRefillReminder(title, body, everyDays);
  if (!id) {
    toast(t('refill.denied'), 'caution');
    return false;
  }
  useMedicines.getState().setRefill(m.key, { notificationId: id, everyDays });
  toast(t('refill.set', { count: everyDays }), 'success');
  return true;
}

export async function turnOffRefill(m: SavedMedicine) {
  const t = i18next.getFixedT(null, 'medicines');
  await cancelReminder(m.refill?.notificationId);
  useMedicines.getState().setRefill(m.key, null);
  useUi.getState().showToast(t('refill.off'), 'info');
}

/** Removes a saved medicine and its reminder. */
export async function removeMedicine(m: SavedMedicine) {
  await cancelReminder(m.refill?.notificationId);
  useMedicines.getState().remove(m.key);
}
