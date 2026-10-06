import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUi } from '@/state/ui';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { motion, radius, spacing } from '../tokens';
import { TAB_BAR_SPACE } from './Screen';

export function ToastHost() {
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  const { palette, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.message);
    const id = setTimeout(hide, 4000);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;
  const s = palette.signals[toast.tone === 'success' ? 'mint' : toast.tone === 'caution' ? 'sunflower' : 'sky'];
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_SPACE }]}>
      <Animated.View
        key={toast.id}
        entering={reduceMotion ? undefined : FadeInDown.duration(motion.base)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(motion.fast)}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: palette.text, borderColor: s.solid }]}>
        <Text variant="label" bold style={{ color: palette.bg }}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  toast: {
    maxWidth: 560,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderLeftWidth: 6,
  },
});
