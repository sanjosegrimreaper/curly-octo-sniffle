import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing, Text } from '@/design';

/** Section title with an optional one-line hint and a trailing action (e.g. a ReadAloud or link). */
export function SectionHeader({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: spacing.xxs, marginTop: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
        <Text variant="heading" style={{ flex: 1, minWidth: 160 }}>
          {title}
        </Text>
        {right}
      </View>
      {hint ? (
        <Text variant="label" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
