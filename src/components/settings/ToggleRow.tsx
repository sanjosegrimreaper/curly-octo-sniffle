import { Check, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { minTap, motion, radius, spacing, Tappable, Text, useTheme, type SignalName } from '@/design';

const TRACK_W = 52;
const TRACK_H = 32;
const KNOB = 24;
const TRAVEL = TRACK_W - KNOB - 8;

/**
 * A settings switch row: the whole row (≥48dp) is one switch for screen readers, with the
 * label, a plain-words description, and a visible On/Off word (never position or color alone).
 */
export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
  note,
  icon: Icon,
  signal = 'sky',
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Shown under the description, e.g. why the switch is disabled. */
  note?: string;
  icon?: LucideIcon;
  signal?: SignalName;
  testID?: string;
}) {
  const { palette, reduceMotion, highContrast } = useTheme();
  const { t } = useTranslation('settings');
  const x = useSharedValue(value ? TRAVEL : 0);

  useEffect(() => {
    x.value = reduceMotion ? (value ? TRAVEL : 0) : withSpring(value ? TRAVEL : 0, motion.spring);
  }, [value, reduceMotion, x]);

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const s = palette.signals[signal];

  return (
    <Tappable
      testID={testID}
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={[description, note].filter(Boolean).join(' ') || undefined}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={styles.row}>
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: s.tint }]}>
          <Icon size={20} color={s.ink} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text variant="subheading" accessibilityRole="text">
          {label}
        </Text>
        {description ? (
          <Text variant="label" tone="muted">
            {description}
          </Text>
        ) : null}
        {note ? (
          <Text variant="caption" tone="sunflower" bold>
            {note}
          </Text>
        ) : null}
      </View>
      <View style={styles.right} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text variant="caption" bold style={{ color: value ? palette.accentInk : palette.textMuted }}>
          {value ? t('on') : t('off')}
        </Text>
        <View
          style={[
            styles.track,
            {
              backgroundColor: value ? palette.accent : palette.surfaceSunken,
              borderColor: value ? palette.accent : highContrast ? palette.border : palette.textMuted,
            },
          ]}>
          <Animated.View
            style={[styles.knob, { backgroundColor: value ? palette.onAccent : palette.textMuted }, knob]}>
            {value ? <Check size={16} color={palette.accent} strokeWidth={3} /> : null}
          </Animated.View>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTap + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  right: { alignItems: 'center', gap: 4 },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: 2, justifyContent: 'center', paddingHorizontal: 2 },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
});
