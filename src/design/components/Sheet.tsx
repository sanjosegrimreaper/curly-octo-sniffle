import { X } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, motion, radius, spacing } from '../tokens';
import { CONTENT_MAX_WIDTH } from './Screen';
import { Tappable } from './Tappable';

/** Bottom sheet built on Modal (works on iOS, Android and web). */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const { palette, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('common');

  useEffect(() => {
    if (visible) AccessibilityInfo.announceForAccessibility(title);
  }, [visible, title]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} testID={testID}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}
          exiting={reduceMotion ? undefined : FadeOut.duration(motion.fast)}
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('close')} accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          entering={reduceMotion ? FadeIn.duration(motion.fast) : SlideInDown.springify().damping(motion.spring.damping).stiffness(motion.spring.stiffness)}
          exiting={reduceMotion ? FadeOut.duration(motion.fast) : SlideOutDown.duration(motion.base)}
          style={[
            styles.sheet,
            { backgroundColor: palette.surface, borderColor: palette.border, paddingBottom: insets.bottom + spacing.md },
          ]}>
          <View style={[styles.grabber, { backgroundColor: palette.border }]} />
          <View style={styles.header}>
            <Text variant="heading" style={{ flex: 1 }}>
              {title}
            </Text>
            <Tappable
              testID="sheet-close"
              onPress={onClose}
              accessibilityLabel={t('close')}
              style={[styles.close, { borderColor: palette.border, backgroundColor: palette.surfaceSunken }]}>
              <X size={22} color={palette.text} />
            </Tappable>
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.md }}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    maxHeight: '88%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  close: { width: minTap, height: minTap, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
