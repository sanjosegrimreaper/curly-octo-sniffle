import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettings } from '@/state/settings';

function enabled() {
  return Platform.OS !== 'web' && useSettings.getState().haptics;
}

export const haptic = {
  tick() {
    if (enabled()) void Haptics.selectionAsync().catch(() => undefined);
  },
  press() {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  success() {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warning() {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};
