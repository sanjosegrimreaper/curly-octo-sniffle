import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { haptic } from '@/services/haptics';

import { useTheme } from '../theme';
import { motion } from '../tokens';

const APressable = Animated.createAnimatedComponent(Pressable);

export type TappableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** 'none' skips the haptic tick. */
  feedback?: 'tick' | 'press' | 'none';
};

/** Every tappable surface: scale-to-0.97 press feedback, haptic tick, visible focus ring for keyboards. */
export const Tappable = forwardRef<View, TappableProps>(function Tappable(
  { style, children, feedback = 'tick', onPressIn, onPressOut, onPress, onFocus, onBlur, disabled, ...rest },
  ref,
) {
  const { reduceMotion, palette } = useTheme();
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <APressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={(e) => {
        if (!reduceMotion) scale.value = withTiming(motion.pressScale, { duration: motion.fast });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) scale.value = withSpring(1, motion.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback === 'tick') haptic.tick();
        else if (feedback === 'press') haptic.press();
        onPress?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        style,
        animated,
        disabled ? { opacity: 0.5 } : null,
        focused ? { borderColor: palette.focus, borderWidth: 3 } : null,
      ]}
      {...rest}>
      {children}
    </APressable>
  );
});
