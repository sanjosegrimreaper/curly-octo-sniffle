import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { minTap, motion, radius, spacing, Tappable, Text, useTheme } from '@/design';

/** A big, friendly checkbox row (documents checklist, before-you-call list). */
export function CheckRow({
  label,
  checked,
  onToggle,
  testID,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const { palette, reduceMotion } = useTheme();
  const mint = palette.signals.mint;
  return (
    <Tappable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={[
        styles.row,
        {
          backgroundColor: checked ? mint.tint : palette.surface,
          borderColor: checked ? mint.solid : palette.border,
        },
      ]}>
      <View
        style={[
          styles.box,
          { borderColor: checked ? mint.solid : palette.borderStrong, backgroundColor: checked ? mint.solid : palette.surface },
        ]}>
        {checked ? (
          <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(motion.base)}>
            <Check size={20} color={palette.surface} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>
      <Text style={{ flex: 1 }} bold={checked}>
        {label}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTap + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  box: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
