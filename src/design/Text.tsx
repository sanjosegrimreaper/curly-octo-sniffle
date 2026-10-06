import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from './theme';
import { typeScale, type SignalName, type TypeVariant } from './tokens';

export type TextTone = 'default' | 'muted' | 'accent' | 'onAccent' | SignalName;

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  bold?: boolean;
  center?: boolean;
  /** Prices and counts: tabular figures so digits don't jump. */
  tabular?: boolean;
};

const HEADING_VARIANTS: readonly TypeVariant[] = ['display', 'title', 'heading', 'subheading'];

export function Text({ variant = 'body', tone = 'default', bold, center, tabular, style, ...rest }: TextProps) {
  const theme = useTheme();
  const { palette, fonts, textScale } = theme;
  const scale = typeScale[variant];
  const isHeading = HEADING_VARIANTS.includes(variant);
  const isPrice = variant === 'price' || variant === 'priceSmall';

  const color =
    tone === 'default'
      ? palette.text
      : tone === 'muted'
        ? palette.textMuted
        : tone === 'accent'
          ? palette.accentInk
          : tone === 'onAccent'
            ? palette.onAccent
            : palette.signals[tone].ink;

  const fontSize = scale.size * textScale;
  const base: TextStyle = {
    color,
    fontSize,
    lineHeight: Math.round(fontSize * scale.line * fonts.lineHeightBoost),
    textAlign: center ? 'center' : undefined,
  };

  if (isPrice) {
    base.fontFamily = fonts.price;
    base.fontVariant = ['tabular-nums'];
    base.letterSpacing = -0.5;
  } else if (isHeading) {
    base.fontFamily = fonts.heading;
    base.fontWeight = fonts.headingWeight;
  } else if (bold) {
    base.fontFamily = fonts.bodyBold;
    base.fontWeight = fonts.boldWeight;
  } else {
    base.fontFamily = fonts.body;
  }
  if (tabular) base.fontVariant = ['tabular-nums'];

  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={2}
      {...rest}
      style={[base, style]}
    />
  );
}
