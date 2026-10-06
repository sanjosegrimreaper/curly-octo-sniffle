import { AlertTriangle, Info, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { radius, spacing, type SignalName } from '../tokens';

export function Banner({
  title,
  body,
  tone = 'info',
  icon,
  children,
  testID,
}: {
  title: string;
  body?: string;
  tone?: 'info' | 'caution' | 'success';
  icon?: LucideIcon;
  children?: ReactNode;
  testID?: string;
}) {
  const { palette } = useTheme();
  const signal: SignalName = tone === 'caution' ? 'sunflower' : tone === 'success' ? 'mint' : 'sky';
  const s = palette.signals[signal];
  const Icon = icon ?? (tone === 'caution' ? AlertTriangle : Info);
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[styles.banner, { backgroundColor: s.tint, borderColor: s.solid }]}>
      <Icon size={22} color={s.ink} />
      <View style={styles.text}>
        <Text variant="label" bold style={{ color: s.ink }}>
          {title}
        </Text>
        {body ? <Text variant="label">{body}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  text: { flex: 1, gap: spacing.xxs },
});
