import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import type { PriceSummary } from '@/data/prices';
import { minTap, motion, radius, Tappable, useTheme } from '@/design';
import { haptic } from '@/services/haptics';
import { selectionKey, useMedicines, type Selection } from '@/state/medicines';
import { useUi } from '@/state/ui';

const BURST = 84;
const RAYS = 8;

/**
 * Save star with the Save burst: the star fills and pops, a small radial burst flies out
 * once (≤600 ms) and the phone gives a success haptic. Tap again to remove.
 * Reduce Motion: no burst, no pop — the star simply fills.
 */
export function SaveStar({ selection, summary, testID = 'save-star' }: { selection: Selection; summary: PriceSummary | null; testID?: string }) {
  const { palette, reduceMotion } = useTheme();
  const { t } = useTranslation('results');
  const key = selectionKey(selection);
  const saved = useMedicines((s) => s.saved.some((m) => m.key === key));
  const save = useMedicines((s) => s.save);
  const remove = useMedicines((s) => s.remove);
  const showToast = useUi((s) => s.showToast);

  const pop = useSharedValue(1);
  const burst = useSharedValue(0);

  const onPress = () => {
    if (saved) {
      remove(key);
      haptic.tick();
      showToast(t('header.removedToast'), 'info');
      AccessibilityInfo.announceForAccessibility(t('header.removedToast'));
      return;
    }
    const lowest = summary?.lowest ?? null;
    save(selection, lowest ? { priceCents: lowest.priceCents, snapshotDate: lowest.snapshotDate ?? lowest.verifiedAsOf } : null);
    haptic.success();
    showToast(t('header.savedToast'), 'success');
    AccessibilityInfo.announceForAccessibility(t('header.savedToast'));
    if (!reduceMotion) {
      pop.value = withSequence(withTiming(1.28, { duration: motion.fast }), withSpring(1, motion.spring));
      burst.value = 0;
      burst.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    }
  };

  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : 1 - burst.value,
    transform: [{ scale: 0.45 + burst.value * 0.75 }, { rotate: `${burst.value * 20}deg` }],
  }));

  const ink = saved ? palette.accentInk : palette.text;
  const c = BURST / 2;

  return (
    <View style={styles.wrap}>
      {!reduceMotion ? (
        <Animated.View pointerEvents="none" style={[styles.burst, burstStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Svg width={BURST} height={BURST}>
            {Array.from({ length: RAYS }, (_, i) => {
              const a = (i / RAYS) * Math.PI * 2;
              const r1 = 24;
              const r2 = 38;
              const color = i % 2 ? palette.signals.sunflower.fill : palette.signals.mint.fill;
              return (
                <Line
                  key={i}
                  x1={c + Math.cos(a) * r1}
                  y1={c + Math.sin(a) * r1}
                  x2={c + Math.cos(a) * r2}
                  y2={c + Math.sin(a) * r2}
                  stroke={color}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              );
            })}
            {Array.from({ length: RAYS }, (_, i) => {
              const a = ((i + 0.5) / RAYS) * Math.PI * 2;
              return <Circle key={`d${i}`} cx={c + Math.cos(a) * 32} cy={c + Math.sin(a) * 32} r={2.5} fill={palette.accent} />;
            })}
          </Svg>
        </Animated.View>
      ) : null}
      <Tappable
        testID={testID}
        feedback="none"
        onPress={onPress}
        accessibilityLabel={saved ? t('header.saved') : t('header.save')}
        accessibilityState={{ selected: saved }}
        style={[
          styles.button,
          {
            backgroundColor: saved ? palette.accentSoft : palette.surface,
            borderColor: saved ? palette.accent : palette.border,
          },
        ]}>
        <Animated.View style={starStyle}>
          <Star size={24} color={ink} fill={saved ? palette.signals.sunflower.fill : 'transparent'} strokeWidth={saved ? 2.25 : 2} />
        </Animated.View>
      </Tappable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: minTap, height: minTap, alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', width: BURST, height: BURST, left: (minTap - BURST) / 2, top: (minTap - BURST) / 2 },
  button: {
    width: minTap,
    height: minTap,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
