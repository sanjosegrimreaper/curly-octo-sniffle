import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '../Text';
import { useTheme } from '../theme';
import { radius, spacing, type SignalName } from '../tokens';

/** Status badge: always icon + text (never color alone). */
export function Badge({ label, signal = 'slate', icon: Icon }: { label: string; signal?: SignalName; icon?: LucideIcon }) {
  const { palette } = useTheme();
  const s = palette.signals[signal];
  return (
    <View style={[styles.badge, { backgroundColor: s.tint, borderColor: s.solid }]}>
      {Icon ? <Icon size={14} color={s.ink} /> : null}
      <Text variant="caption" bold style={{ color: s.ink }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
