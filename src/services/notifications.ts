/**
 * Local-only reminders (refills, program renewals). Nothing is sent to a server.
 * By default the reminder text does not name the medicine (lock screens are visible to others).
 */
// The legacy API is the one available in Expo Go on SDK 57.
import * as Calendar from 'expo-calendar/legacy';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  ensureHandler();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Repeating reminder every N days at 9:00 local time. Returns the notification id or null. */
export async function scheduleRefillReminder(title: string, body: string, everyDays: number): Promise<string | null> {
  if (!(await ensurePermission())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, everyDays) * 24 * 60 * 60,
        repeats: true,
      },
    });
  } catch {
    return null;
  }
}

/** One-time reminder on a date (YYYY-MM-DD) at 9:00 local time. */
export async function scheduleDateReminder(title: string, body: string, isoDate: string): Promise<string | null> {
  if (!(await ensurePermission())) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 9, 0, 0);
  if (date.getTime() <= Date.now()) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string | null | undefined) {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already gone
  }
}

/** Adds an all-day event to the default calendar. Returns false when unavailable or denied. */
export async function addCalendarEvent(title: string, isoDate: string, notes: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (!perm.granted) return false;
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return false;
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 1);
    let calendarId: string | undefined;
    if (Platform.OS === 'ios') {
      calendarId = (await Calendar.getDefaultCalendarAsync()).id;
    } else {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      calendarId = cals.find((c) => c.allowsModifications && c.isPrimary)?.id ?? cals.find((c) => c.allowsModifications)?.id;
    }
    if (!calendarId) return false;
    await Calendar.createEventAsync(calendarId, { title, startDate: start, endDate: end, allDay: true, notes });
    return true;
  } catch {
    return false;
  }
}
