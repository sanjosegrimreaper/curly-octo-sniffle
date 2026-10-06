import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { radius, useTheme } from '@/design';

/**
 * Rising bars that show where a bracket sits on the income ladder (bracket 1 of 4 = one bar filled).
 * Decorative: the card's text carries the meaning.
 */
export function IncomeLevelIcon({ level, of, selected }: { level: number; of: number; selected?: boolean }) {
  const { palette } = useTheme();
  const n = Math.max(1, of);
  const barW = 5;
  const gap = 3;
  const w = n * barW + (n - 1) * gap;
  const h = 22;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        backgroundColor: selected ? palette.surface : palette.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {Array.from({ length: n }, (_, i) => {
          const bh = 6 + ((h - 6) * i) / Math.max(1, n - 1);
          return (
            <Rect
              key={i}
              x={i * (barW + gap)}
              y={h - bh}
              width={barW}
              height={bh}
              rx={2}
              fill={i <= level ? palette.accent : palette.borderStrong}
              opacity={i <= level ? 1 : 0.4}
            />
          );
        })}
      </Svg>
    </View>
  );
}
