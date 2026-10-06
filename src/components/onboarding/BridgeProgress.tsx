import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { motion, Text, useTheme } from '@/design';

import type { StepName } from './steps';

const APath = Animated.createAnimatedComponent(Path);
const ARect = Animated.createAnimatedComponent(Rect);
const ALine = Animated.createAnimatedComponent(Line);
const ACircle = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------- geometry (viewBox units)
const VB_W = 320;
const VB_H = 92;
const LEFT = 22;
const RIGHT = 298;
const SPAN = RIGHT - LEFT;
const DECK_Y = 62;
/** Control point of the arch; the arch peaks at (DECK_Y + CTRL_Y) / 2. */
const CTRL_Y = -6;
const ARC_D = `M${LEFT} ${DECK_Y} Q${(LEFT + RIGHT) / 2} ${CTRL_Y} ${RIGHT} ${DECK_Y}`;
/** About this many planks span the deck, whatever the number of steps. */
const TARGET_PLANKS = 12;
const PLANK_H = 8;
const PLANK_Y = DECK_Y - PLANK_H / 2;
const DOT_Y = DECK_Y - 12;
/** The dot crosses the deck in this long (spec: ≤ 700 ms). */
const WALK_MS = 640;

/** Height of the arch above x (quadratic Bézier; x is linear in t because the control point is centered). */
function arcY(x: number) {
  const t = (x - LEFT) / SPAN;
  return (1 - t) * (1 - t) * DECK_Y + 2 * (1 - t) * t * CTRL_Y + t * t * DECK_Y;
}

/** Arch length from the left bank to fraction `f` of the span (numeric, 96 segments per full span). */
function arcLengthTo(f: number) {
  const n = Math.max(1, Math.round(96 * f));
  let len = 0;
  let px = LEFT;
  let py = DECK_Y;
  for (let i = 1; i <= n; i++) {
    const x = LEFT + (SPAN * f * i) / n;
    const y = arcY(x);
    len += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return len;
}

const ARC_LENGTH = Math.ceil(arcLengthTo(1)) + 2;
/** Share of the arch's length drawn when the deck is built to fraction `f` of the span. */
const drawnShare = (f: number) => (f >= 1 ? 1 : arcLengthTo(Math.max(0, f)) / ARC_LENGTH);

/** Planks for one step, so a 3-step path and a 6-step path both fill the deck evenly. */
export function planksPerStep(total: number) {
  return Math.max(1, Math.round(TARGET_PLANKS / Math.max(1, total)));
}

export type BridgeProgressProps = {
  /** 1-based step on the current path. The last step completes the arch and walks the glowing dot across. */
  now: number;
  /** Steps on the current path (changes when the path changes). */
  total: number;
  /** Shown after "Step N of M". */
  name: StepName;
};

/**
 * The Bridge: an arch bridge that builds plank by plank across the top of the screener.
 * It is also the accessible progress bar ("Step 3 of 6").
 */
export function BridgeProgress({ now: rawNow, total: rawTotal, name }: BridgeProgressProps) {
  const { palette, reduceMotion, scheme, textScale } = useTheme();
  const { t } = useTranslation('onboarding');
  const hangerOpacity = scheme === 'dark' ? 0.6 : 0.4;
  const total = Math.max(1, Math.round(rawTotal));
  const now = Math.min(total, Math.max(1, Math.round(rawNow)));
  const label = t('steps.label', { now, total });
  const isFinal = now === total;

  const perStep = planksPerStep(total);
  const plankCount = perStep * total;
  const pitch = SPAN / plankCount;
  const plankX = (k: number) => LEFT + k * pitch + 1.5;
  const plankCenter = (k: number) => LEFT + (k + 0.5) * pitch;
  const plankW = pitch - 3;

  const from = drawnShare((now - 1) / total);
  const to = drawnShare(now / total);
  const arc = useSharedValue(reduceMotion ? to : from);
  const walk = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      arc.value = to;
      glow.value = 0;
      return;
    }
    const ease = Easing.bezier(...motion.easing);
    arc.value = withTiming(to, { duration: motion.slow, easing: ease });
    if (isFinal) {
      const start = motion.slow;
      walk.value = 0;
      walk.value = withDelay(start, withTiming(1, { duration: WALK_MS, easing: Easing.inOut(Easing.quad) }));
      glow.value = withDelay(
        start,
        withSequence(
          withTiming(1, { duration: motion.fast }),
          withDelay(WALK_MS - motion.fast - motion.fast, withTiming(0, { duration: motion.fast })),
        ),
      );
    }
  }, [reduceMotion, to, isFinal, arc, walk, glow]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - arc.value) }));
  const dotProps = useAnimatedProps(() => ({ cx: LEFT + walk.value * SPAN, opacity: glow.value }));
  const haloProps = useAnimatedProps(() => ({ cx: LEFT + walk.value * SPAN, opacity: glow.value * 0.28 }));

  const builtBefore = (now - 1) * perStep;
  const ghost = palette.borderStrong;
  const water = palette.signals.sky.fill;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('steps.progressLabel')}
      accessibilityValue={{ min: 1, max: total, now, text: label }}
      style={styles.wrap}
      testID="bridge-progress">
      <Text
        variant="label"
        tone="accent"
        bold
        importantForAccessibility="no"
        accessibilityElementsHidden
        testID="bridge-label">
        {t('steps.labelWithName', { now, total, name: t(`steps.${name}`) })}
      </Text>
      <View
        style={[styles.art, textScale > 1.15 ? { maxWidth: 300 } : null]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
          {/* water */}
          <Path
            d={`M4 ${VB_H - 8} q 12 -5 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0 t 24 0`}
            stroke={water}
            strokeOpacity={0.45}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          {/* piers */}
          <Rect x={LEFT - 6} y={DECK_Y} width={12} height={VB_H - DECK_Y - 12} rx={3} fill={ghost} opacity={0.7} />
          <Rect x={RIGHT - 6} y={DECK_Y} width={12} height={VB_H - DECK_Y - 12} rx={3} fill={ghost} opacity={0.7} />
          {/* the whole bridge, faint, so people can see what is being built */}
          <Path
            d={ARC_D}
            stroke={ghost}
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="3 6"
            fill="none"
            strokeLinecap="round"
          />
          <Line
            x1={LEFT}
            y1={DECK_Y}
            x2={RIGHT}
            y2={DECK_Y}
            stroke={ghost}
            strokeOpacity={0.55}
            strokeWidth={3}
            strokeDasharray="2 5"
            strokeLinecap="round"
          />
          {/* hangers + planks already built */}
          {Array.from({ length: builtBefore }, (_, k) => (
            <Line
              key={`h${k}`}
              x1={plankCenter(k)}
              y1={arcY(plankCenter(k)) + 2}
              x2={plankCenter(k)}
              y2={PLANK_Y}
              stroke={palette.accent}
              strokeOpacity={hangerOpacity}
              strokeWidth={1.5}
            />
          ))}
          {Array.from({ length: builtBefore }, (_, k) => (
            <Rect
              key={`p${k}`}
              x={plankX(k)}
              y={PLANK_Y}
              width={plankW}
              height={PLANK_H}
              rx={2.5}
              fill={palette.accent}
            />
          ))}
          {/* this step's planks spring in */}
          {Array.from({ length: perStep }, (_, i) => (
            <NewPlank
              key={`n${total}-${now}-${i}`}
              x={plankX(builtBefore + i)}
              cx={plankCenter(builtBefore + i)}
              width={plankW}
              order={i}
              color={palette.accent}
              hangerOpacity={hangerOpacity}
              reduceMotion={reduceMotion}
            />
          ))}
          {/* the arch draws as far as the current step */}
          <APath
            d={ARC_D}
            stroke={palette.accent}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
            animatedProps={arcProps}
          />
          {isFinal && !reduceMotion ? (
            <>
              <ACircle cy={DOT_Y} r={11} fill={palette.accent} animatedProps={haloProps} />
              <ACircle
                cy={DOT_Y}
                r={5}
                fill={palette.signals.sunflower.fill}
                stroke={palette.surface}
                strokeWidth={2}
                animatedProps={dotProps}
              />
            </>
          ) : null}
        </Svg>
      </View>
    </View>
  );
}

/** One plank of the current step: drops onto the deck with a spring; its hanger fades in with it. */
function NewPlank({
  x,
  cx,
  width,
  order,
  color,
  hangerOpacity,
  reduceMotion,
}: {
  x: number;
  cx: number;
  width: number;
  order: number;
  color: string;
  hangerOpacity: number;
  reduceMotion: boolean;
}) {
  const p = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      p.value = 1;
      return;
    }
    p.value = withDelay(80 + order * 60, withSpring(1, motion.spring));
  }, [reduceMotion, order, p]);

  const plankProps = useAnimatedProps(() => ({
    y: PLANK_Y - (1 - p.value) * 16,
    opacity: Math.min(1, Math.max(0, p.value * 1.6)),
  }));
  const hangerProps = useAnimatedProps(() => ({ strokeOpacity: Math.max(0, Math.min(1, p.value)) * hangerOpacity }));

  return (
    <>
      <ALine
        x1={cx}
        y1={arcY(cx) + 2}
        x2={cx}
        y2={PLANK_Y}
        stroke={color}
        strokeWidth={1.5}
        animatedProps={hangerProps}
      />
      <ARect x={x} width={width} height={PLANK_H} rx={2.5} fill={color} animatedProps={plankProps} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 6 },
  art: { width: '100%', maxWidth: 420, aspectRatio: VB_W / VB_H, alignSelf: 'center' },
});
