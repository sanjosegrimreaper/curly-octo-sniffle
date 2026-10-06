import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme';

export type IllustrationName =
  | 'pillBottle'
  | 'bridge'
  | 'storefront'
  | 'phone'
  | 'folder'
  | 'mapPin'
  | 'calendar'
  | 'magnifier'
  | 'shield';

/** Flat geometric spot illustrations in the signal palette. Decorative: hidden from screen readers. */
export function Illustration({ name, size = 120 }: { name: IllustrationName; size?: number }) {
  const { palette } = useTheme();
  const s = palette.signals;
  const ground = palette.accentSoft;
  const ink = palette.text;

  const art = (() => {
    switch (name) {
      case 'pillBottle':
        return (
          <G>
            <Ellipse cx="60" cy="104" rx="38" ry="6" fill={ground} />
            <Rect x="34" y="34" width="52" height="66" rx="10" fill={s.sky.fill} />
            <Rect x="30" y="20" width="60" height="18" rx="6" fill={s.lilac.fill} />
            <Rect x="40" y="50" width="40" height="30" rx="5" fill="#FFFFFF" />
            <Line x1="46" y1="60" x2="74" y2="60" stroke={ink} strokeWidth="3" strokeLinecap="round" />
            <Line x1="46" y1="70" x2="66" y2="70" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity={0.5} />
            <Rect x="88" y="66" width="22" height="10" rx="5" fill={s.mint.fill} transform="rotate(-30 99 71)" />
          </G>
        );
      case 'bridge':
        return (
          <G>
            <Rect x="0" y="86" width="120" height="22" rx="6" fill={s.sky.tint} />
            <Path d="M8 84 Q60 20 112 84" stroke={palette.accent} strokeWidth="6" fill="none" strokeLinecap="round" />
            <Line x1="4" y1="84" x2="116" y2="84" stroke={ink} strokeWidth="5" strokeLinecap="round" />
            {[24, 42, 60, 78, 96].map((x) => (
              <Line key={x} x1={x} y1="84" x2={x} y2={x === 60 ? 52 : x === 42 || x === 78 ? 57 : 68} stroke={palette.accent} strokeWidth="3" />
            ))}
            <Circle cx="96" cy="30" r="10" fill={s.sunflower.fill} />
            <Rect x="50" y="94" width="20" height="8" rx="4" fill={s.mint.fill} />
          </G>
        );
      case 'storefront':
        return (
          <G>
            <Ellipse cx="60" cy="106" rx="44" ry="5" fill={ground} />
            <Rect x="18" y="40" width="84" height="64" rx="6" fill="#FFFFFF" stroke={palette.border} strokeWidth="2" />
            <Path d="M14 40 L24 18 H96 L106 40 Z" fill={s.coral.fill} />
            {[14, 34, 54, 74, 94].map((x, i) => (
              <Path key={x} d={`M${x} 40 q10 12 20 0`} fill={i % 2 ? s.coral.fill : '#FFFFFF'} />
            ))}
            <Rect x="28" y="56" width="26" height="22" rx="4" fill={s.sky.tint} stroke={s.sky.fill} strokeWidth="2" />
            <Rect x="64" y="60" width="26" height="44" rx="4" fill={s.lilac.fill} />
            <Rect x="72" y="26" width="16" height="8" rx="2" fill="#FFFFFF" />
            <Path d="M80 24 v12 M74 30 h12" stroke={s.mint.solid} strokeWidth="3" />
          </G>
        );
      case 'phone':
        return (
          <G>
            <Ellipse cx="60" cy="106" rx="30" ry="5" fill={ground} />
            <Rect x="36" y="14" width="48" height="88" rx="10" fill={palette.accent} />
            <Rect x="41" y="24" width="38" height="64" rx="4" fill="#FFFFFF" />
            <Circle cx="60" cy="95" r="3" fill="#FFFFFF" />
            <Path d="M52 48 c0 8 8 16 16 16 l3 -5 -6 -4 -3 3 c-3 -1 -6 -4 -7 -7 l3 -3 -4 -6 Z" fill={s.mint.solid} />
            <Path d="M88 30 q8 8 0 16 M94 24 q14 14 0 28" stroke={s.sunflower.solid} strokeWidth="3" fill="none" strokeLinecap="round" />
          </G>
        );
      case 'folder':
        return (
          <G>
            <Ellipse cx="60" cy="106" rx="42" ry="5" fill={ground} />
            <Rect x="30" y="18" width="56" height="70" rx="4" fill="#FFFFFF" stroke={palette.border} strokeWidth="2" transform="rotate(-6 58 53)" />
            <Line x1="40" y1="34" x2="74" y2="30" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity={0.5} />
            <Path d="M16 44 H48 l8 8 H104 V98 a6 6 0 0 1 -6 6 H22 a6 6 0 0 1 -6 -6 Z" fill={s.sunflower.fill} />
            <Path d="M44 74 l10 10 20 -22" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        );
      case 'mapPin':
        return (
          <G>
            <Ellipse cx="60" cy="104" rx="26" ry="6" fill={ground} />
            <Path d="M60 100 C40 72 30 60 30 44 a30 30 0 0 1 60 0 c0 16 -10 28 -30 56 Z" fill={s.coral.fill} />
            <Circle cx="60" cy="44" r="12" fill="#FFFFFF" />
            <Path d="M60 37 v14 M53 44 h14" stroke={s.coral.solid} strokeWidth="4" strokeLinecap="round" />
          </G>
        );
      case 'calendar':
        return (
          <G>
            <Ellipse cx="60" cy="106" rx="40" ry="5" fill={ground} />
            <Rect x="20" y="24" width="80" height="76" rx="10" fill="#FFFFFF" stroke={palette.border} strokeWidth="2" />
            <Rect x="20" y="24" width="80" height="20" rx="10" fill={s.lilac.fill} />
            <Line x1="40" y1="16" x2="40" y2="32" stroke={ink} strokeWidth="5" strokeLinecap="round" />
            <Line x1="80" y1="16" x2="80" y2="32" stroke={ink} strokeWidth="5" strokeLinecap="round" />
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <Rect
                  key={`${r}-${c}`}
                  x={30 + c * 16}
                  y={52 + r * 14}
                  width="10"
                  height="9"
                  rx="2"
                  fill={r === 1 && c === 2 ? s.mint.fill : palette.accentSoft}
                />
              )),
            )}
          </G>
        );
      case 'magnifier':
        return (
          <G>
            <Ellipse cx="60" cy="106" rx="34" ry="5" fill={ground} />
            <Circle cx="52" cy="50" r="30" fill={s.sky.tint} stroke={palette.accent} strokeWidth="8" />
            <Line x1="74" y1="72" x2="98" y2="96" stroke={palette.accent} strokeWidth="12" strokeLinecap="round" />
            <Rect x="38" y="44" width="28" height="12" rx="6" fill={s.mint.fill} transform="rotate(-30 52 50)" />
          </G>
        );
      case 'shield':
        return (
          <G>
            <Ellipse cx="60" cy="106" rx="30" ry="5" fill={ground} />
            <Path d="M60 12 L96 26 V54 C96 78 80 94 60 102 C40 94 24 78 24 54 V26 Z" fill={s.mint.fill} />
            <Path d="M44 56 l12 12 22 -24" stroke="#FFFFFF" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        );
    }
  })();

  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ alignSelf: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 120 112">
        {art}
      </Svg>
    </View>
  );
}
