import { ExternalLink, type LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, primaryButtonHeight, radius, spacing } from '../tokens';
import { Tappable } from './Tappable';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  /** Opens a website: shows the link-out icon and tells screen readers. */
  external?: boolean;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  external,
  hint,
  disabled,
  loading,
  compact,
  style,
  testID,
}: ButtonProps) {
  const { palette } = useTheme();
  const colors = {
    primary: { bg: palette.accent, fg: palette.onAccent, border: palette.accent },
    secondary: { bg: palette.surface, fg: palette.accentInk, border: palette.accent },
    ghost: { bg: 'transparent', fg: palette.accentInk, border: 'transparent' },
    danger: { bg: palette.surface, fg: palette.signals.coral.ink, border: palette.signals.coral.solid },
  }[variant];

  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      feedback={variant === 'primary' ? 'press' : 'tick'}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[
        styles.base,
        {
          minHeight: compact ? minTap : primaryButtonHeight,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
        },
        style,
      ]}>
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={colors.fg} /> : Icon ? <Icon color={colors.fg} size={22} style={{ flexShrink: 0 }} /> : null}
        <Text
          variant={compact ? 'label' : 'subheading'}
          style={{ color: colors.fg, flexShrink: 1 }}
          center
          bold={compact}>
          {label}
        </Text>
        {external ? <ExternalLink color={colors.fg} size={18} aria-hidden style={{ flexShrink: 0 }} /> : null}
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
