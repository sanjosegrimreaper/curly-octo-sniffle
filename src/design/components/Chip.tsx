import { Check } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, radius, spacing } from '../tokens';
import { Tappable } from './Tappable';

/** Selectable chip (strength, quantity, filters). Selected state shows a check, not just color. */
export function Chip({
  label,
  selected,
  onPress,
  accessibilityHint,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { palette } = useTheme();
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, checked: !!selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? palette.accentSoft : palette.surface,
          borderColor: selected ? palette.accent : palette.border,
        },
      ]}>
      {selected ? <Check size={18} color={palette.accentInk} /> : null}
      <Text variant="label" bold={selected} style={{ color: selected ? palette.accentInk : palette.text }}>
        {label}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTap,
    minWidth: minTap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
});
