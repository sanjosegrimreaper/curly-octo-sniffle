import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../theme';
import { radius, spacing, type SignalName } from '../tokens';

export type CardProps = {
  children: ReactNode;
  /** Signal color for the card's meaning (mint = buy now, sky = coupon, slate = reference, ...). */
  signal?: SignalName;
  /** 'solid' = tinted fill; 'outline' = colored border on white; 'hatched' = reference-only pattern. */
  treatment?: 'plain' | 'solid' | 'outline' | 'hatched' | 'dashed';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

export function Card({ children, signal, treatment = 'plain', style, padded = true, testID, accessibilityLabel }: CardProps) {
  const { palette, highContrast } = useTheme();
  const s = signal ? palette.signals[signal] : null;
  const bg = treatment === 'solid' && s ? s.tint : palette.surface;
  const borderColor =
    s && (treatment === 'outline' || treatment === 'solid' || treatment === 'dashed' || treatment === 'hatched')
      ? s.solid
      : palette.border;

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: highContrast ? 2 : treatment === 'plain' ? 1 : 2,
          borderStyle: treatment === 'dashed' ? 'dashed' : 'solid',
          shadowColor: palette.shadow,
        },
        padded && styles.padded,
        style,
      ]}>
      {treatment === 'hatched' && s ? <Hatch color={s.fill} /> : null}
      {children}
    </View>
  );
}

function Hatch({ color }: { color: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
            <Line x1="0" y1="0" x2="0" y2="10" stroke={color} strokeWidth="2" strokeOpacity="0.22" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hatch)" />
      </Svg>
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
  padded: { padding: spacing.md, gap: spacing.xs },
});
