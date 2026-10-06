import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { minTap, radius, spacing, type SignalName } from '../tokens';
import { Tappable } from './Tappable';

export function ListRow({
  title,
  subtitle,
  icon: Icon,
  signal = 'lilac',
  right,
  onPress,
  accessibilityHint,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  signal?: SignalName;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { palette } = useTheme();
  const s = palette.signals[signal];
  const content = (
    <>
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: s.tint }]}>
          <Icon size={22} color={s.ink} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="subheading" style={{ fontSize: 17 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <ChevronRight size={22} color={palette.textMuted} /> : null}
    </>
  );
  const style = [styles.row, { backgroundColor: palette.surface, borderColor: palette.border }];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Tappable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={style}>
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTap + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
