import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, Text, useTheme } from '@/design';

/** A titled group of settings rows on one surface, with thin dividers between rows. */
export function SettingsGroup({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const { palette, highContrast } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: spacing.xs }} testID={testID}>
      <Text variant="heading" style={{ marginTop: spacing.sm }}>
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: highContrast ? 2 : 1, shadowColor: palette.shadow },
        ]}>
        {rows.map((row, i) => (
          <View key={row.key ?? i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: palette.border } : null}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A row with a label, optional description and any control below (chips, segmented, buttons). */
export function SettingsBlock({ label, description, children }: { label: string; description?: string; children?: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text variant="subheading">{label}</Text>
      {description ? (
        <Text variant="label" tone="muted">
          {description}
        </Text>
      ) : null}
      {children ? <View style={{ marginTop: spacing.xs, gap: spacing.sm }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  block: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: 2 },
});
