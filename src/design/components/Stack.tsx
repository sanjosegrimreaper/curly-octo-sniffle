import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '../tokens';

/** Vertical stack with consistent gaps. */
export function VStack({ gap = 'md', children, style }: { gap?: keyof typeof spacing; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap: spacing[gap] }, style]}>{children}</View>;
}

/** Horizontal row that wraps (so 200% text never clips). */
export function HStack({
  gap = 'xs',
  children,
  style,
  wrap = true,
  align = 'center',
}: {
  gap?: keyof typeof spacing;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
  align?: 'center' | 'flex-start' | 'flex-end' | 'stretch';
}) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: spacing[gap], alignItems: align }, style]}>
      {children}
    </View>
  );
}
