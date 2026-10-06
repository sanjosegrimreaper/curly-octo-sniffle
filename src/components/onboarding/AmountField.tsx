import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { minTap, radius, spacing, Text, typeScale, useTheme } from '@/design';

/**
 * Parses what someone typed as an amount: allows "$", commas and spaces ("$1,250.50").
 * Returns null for empty, negative or non-numeric input.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A labeled numeric field (money or a count). Big type, sunken well, visible focus ring. */
export function AmountField({
  label,
  value,
  onChangeText,
  prefix,
  placeholder,
  hint,
  error,
  decimal = true,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** e.g. "$" */
  prefix?: string;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  /** Allow cents (decimal keypad); false = whole numbers (number pad). */
  decimal?: boolean;
  testID?: string;
}) {
  const { palette, fonts, textScale } = useTheme();
  const [focused, setFocused] = useState(false);
  const fontSize = typeScale.heading.size * textScale;
  const borderColor = error ? palette.signals.coral.solid : focused ? palette.focus : palette.border;

  return (
    <View style={styles.wrap}>
      <Text variant="label" bold>
        {label}
      </Text>
      <View
        style={[
          styles.well,
          { backgroundColor: palette.surfaceSunken, borderColor, borderWidth: focused || error ? 2 : 1 },
        ]}>
        {prefix ? (
          <Text variant="heading" tone="muted" importantForAccessibility="no" accessibilityElementsHidden>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode={decimal ? 'decimal' : 'numeric'}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          accessibilityLabel={label}
          accessibilityHint={hint}
          maxFontSizeMultiplier={2}
          style={[
            styles.input,
            {
              color: palette.text,
              fontSize,
              fontFamily: fonts.price,
              fontVariant: ['tabular-nums'],
            },
          ]}
        />
      </View>
      {error ? (
        <Text variant="label" tone="coral" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="label" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  well: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: minTap + 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  input: { flex: 1, minHeight: minTap, paddingVertical: spacing.xs, minWidth: 0 },
});
