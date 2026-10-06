import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion, useTheme } from '@/design';

export type FlipFace = 'front' | 'back';

/**
 * Show-the-math flip. The card turns edge-on (rotateY 0 → 90°), swaps faces while it is
 * invisible, then turns back (−90° → 0). Faces may have different heights; the swap
 * happens edge-on so the height change is never seen. With Reduce Motion it is a
 * ≤150 ms crossfade. Each face gets `flip` to wire to its own visible button.
 */
export function FlipCard({
  front,
  back,
  testID,
}: {
  front: (flip: () => void) => ReactNode;
  back: (flip: () => void) => ReactNode;
  testID?: string;
}) {
  const { reduceMotion } = useTheme();
  const { t } = useTranslation('results');
  const [face, setFace] = useState<FlipFace>('front');
  const [busy, setBusy] = useState(false);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(1);

  const swapped = (next: FlipFace) => {
    setFace(next);
    setBusy(false);
    AccessibilityInfo.announceForAccessibility(next === 'back' ? t('buyNow.mathShown') : t('buyNow.priceShown'));
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: 75 });
    } else {
      rot.value = -90;
      rot.value = withTiming(0, { duration: motion.base - 20, easing: Easing.bezier(0.2, 0, 0, 1) });
    }
  };

  const flip = () => {
    if (busy) return;
    const next: FlipFace = face === 'front' ? 'back' : 'front';
    setBusy(true);
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: 75 }, (done) => {
        if (done) scheduleOnRN(swapped, next);
      });
    } else {
      rot.value = withTiming(90, { duration: motion.fast + 20, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(swapped, next);
      });
    }
  };

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ perspective: 1000 }, { rotateY: `${rot.value}deg` }],
  }));

  return (
    <Animated.View style={style} testID={testID}>
      <View
        accessibilityActions={[{ name: 'flip', label: face === 'front' ? t('buyNow.showMath') : t('buyNow.showPrice') }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'flip') flip();
        }}>
        {face === 'front' ? front(flip) : back(flip)}
      </View>
    </Animated.View>
  );
}
