import { Check, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { GlossaryChip, motion, radius, spacing, Tappable, Text, useTheme } from '@/design';

/** One check-off row. The glossary chip sits outside the checkbox so the two controls never nest. */
export function ChecklistItem({
  label,
  icon: Icon,
  checked,
  onToggle,
  glossaryTermId,
  testID,
}: {
  label: string;
  icon: LucideIcon;
  checked: boolean;
  onToggle: () => void;
  glossaryTermId?: string;
  testID?: string;
}) {
  const { palette, reduceMotion } = useTheme();
  const mint = palette.signals.mint;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: checked ? mint.tint : palette.surface,
          borderColor: checked ? mint.solid : palette.border,
          shadowColor: palette.shadow,
        },
      ]}>
      <Tappable
        testID={testID}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={styles.row}>
        <View
          style={[
            styles.box,
            { borderColor: checked ? mint.solid : palette.borderStrong, backgroundColor: palette.surface },
          ]}>
          {checked ? (
            <Animated.View
              entering={reduceMotion ? undefined : ZoomIn.springify().damping(motion.spring.damping).stiffness(280)}
              style={[styles.boxFill, { backgroundColor: mint.solid }]}>
              <Check size={20} color={palette.surface} strokeWidth={3} />
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.text}>
          <Text variant="body" bold={checked}>
            {label}
          </Text>
        </View>
        <Icon size={22} color={checked ? mint.ink : palette.textMuted} />
      </Tappable>
      {glossaryTermId ? (
        <View style={styles.chip}>
          <GlossaryChip termId={glossaryTermId} />
        </View>
      ) : null}
    </View>
  );
}

const BOX = 30;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  box: { width: BOX, height: BOX, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  boxFill: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  chip: {
    paddingLeft: spacing.md + BOX + spacing.sm,
    paddingRight: spacing.md,
    paddingBottom: spacing.sm,
    marginTop: -spacing.xxs,
  },
});
