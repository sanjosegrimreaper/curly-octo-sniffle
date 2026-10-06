import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useTheme } from '../theme';

/** The subtle sky-blue graph paper behind every screen. Static, drawn once; hidden in high contrast. */
export const GraphPaper = memo(function GraphPaper() {
  const { palette, showGrid } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      {showGrid ? (
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="minor" width="24" height="24" patternUnits="userSpaceOnUse">
              <Path d="M 24 0 L 0 0 0 24" fill="none" stroke={palette.grid} strokeWidth="1" />
            </Pattern>
            <Pattern id="major" width="96" height="96" patternUnits="userSpaceOnUse">
              <Rect width="96" height="96" fill="url(#minor)" />
              <Path d="M 96 0 L 0 0 0 96" fill="none" stroke={palette.gridMajor} strokeWidth="1" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#major)" />
        </Svg>
      ) : null}
    </View>
  );
});
